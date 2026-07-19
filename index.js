require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, Collection } = require('discord.js')
const { supabaseAdmin } = require('./lib/supabaseAdmin')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.commands = new Collection()

// Laad automatisch alle bestanden in de map 'commands'
const commandsPath = path.join(__dirname, 'commands')
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file))
  client.commands.set(command.data.name, command)
}

client.once('ready', () => {
  console.log(`Ingelogd als ${client.user.tag}`)
})

client.on('interactionCreate', async (interaction) => {
  try {
    // Een slash-commando zoals /aanmelden of /koppel-server
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName)
      if (!command) return
      await command.execute(interaction)
      return
    }

    // Een keuze uit het dropdown-menu van /aanmelden (bij meerdere actieve events)
    if (interaction.isStringSelectMenu() && interaction.customId === 'aanmelden_select_event') {
      await interaction.deferUpdate()

      const eventId = interaction.values[0]
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('id, name')
        .eq('id', eventId)
        .single()

      const aanmeldenCommand = client.commands.get('aanmelden')
      const osrsName = aanmeldenCommand.consumePendingOsrsName(interaction.user.id)
      const message = await aanmeldenCommand.registerParticipant(interaction, event.id, event.name, osrsName)

      await interaction.editReply({ content: message, components: [] })
      return
    }

    // /gooi: keuze van event (als er meerdere actieve Ganzebord-events zijn)
    if (interaction.isStringSelectMenu() && interaction.customId === 'gooi_select_event') {
      await interaction.deferUpdate()
      const gooiCommand = client.commands.get('gooi')
      await gooiCommand.showTeamMenuOrRoll(interaction, interaction.values[0])
      return
    }

    // /gooi: keuze van team -> voert de worp meteen uit
    if (interaction.isStringSelectMenu() && interaction.customId === 'gooi_select_team') {
      await interaction.deferUpdate()
      const gooiCommand = client.commands.get('gooi')
      const message = await gooiCommand.rollForTeam(interaction.values[0])
      await interaction.editReply({ content: message, components: [] })
      return
    }

    // /stand: keuze van event (als er meerdere actieve Ganzebord-events zijn)
    if (interaction.isStringSelectMenu() && interaction.customId === 'stand_select_event') {
      await interaction.deferUpdate()
      const standCommand = client.commands.get('stand')
      await standCommand.showStandings(interaction, interaction.values[0])
      return
    }
  } catch (err) {
    console.error(err)
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Er ging iets mis.', ephemeral: true }).catch(() => {})
    }
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
