require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { REST, Routes } = require('discord.js')

const commands = []
const commandsPath = path.join(__dirname, 'commands')
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file))
  commands.push(command.data.toJSON())
}

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN)

;(async () => {
  try {
    if (process.env.DISCORD_GUILD_ID) {
      // Registreren voor één specifieke server: direct actief, ideaal om te testen
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
        { body: commands }
      )
      console.log('Commando\'s geregistreerd voor je test-server (direct beschikbaar).')
    } else {
      // Globaal registreren: werkt overal waar de bot lid is, maar kan tot ~1 uur duren
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
        body: commands,
      })
      console.log('Commando\'s globaal geregistreerd (kan tot een uur duren voor ze zichtbaar zijn).')
    }
  } catch (err) {
    console.error(err)
  }
})()
