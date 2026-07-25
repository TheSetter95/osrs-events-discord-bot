const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

async function showEventLink(interaction, event, communitySlug) {
  const websiteUrl = process.env.WEBSITE_URL

  if (!websiteUrl) {
    return interaction.editReply(
      'De bot weet niet waar de website staat (WEBSITE_URL ontbreekt). Vraag de beheerder van de bot om dit in te stellen.'
    )
  }

  const link = `${websiteUrl.replace(/\/$/, '')}/communities/${communitySlug}/events/${event.id}`

  return interaction.editReply(`🔗 **${event.name}**:\n${link}`)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Toon de link naar de webpagina van een actief event'),

  showEventLink,

  async execute(interaction) {
    // Ephemeral: puur een persoonlijke snelkoppeling, hoeft niet het hele kanaal in
    await interaction.deferReply({ ephemeral: true })

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('id, slug')
      .eq('discord_guild_id', interaction.guildId)
      .single()

    if (!community) {
      return interaction.editReply(
        'Deze Discord-server is nog niet gekoppeld aan een community. Vraag de eigenaar om /koppel-server uit te voeren.'
      )
    }

    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('community_id', community.id)
      .eq('status', 'active')

    if (!events || events.length === 0) {
      return interaction.editReply('Er is nu geen actief event.')
    }

    if (events.length === 1) {
      return showEventLink(interaction, events[0], community.slug)
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('event_select')
      .setPlaceholder('Kies een event')
      .addOptions(events.map((e) => ({ label: e.name, value: e.id })))

    const row = new ActionRowBuilder().addComponents(menu)

    return interaction.editReply({
      content: 'Van welk event wil je de link?',
      components: [row],
    })
  },
}
