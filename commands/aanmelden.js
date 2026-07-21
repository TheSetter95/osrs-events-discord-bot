const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

// Onthoudt tijdelijk de opgegeven OSRS-naam tussen het moment van /aanmelden
// (met meerdere actieve events) en de keuze uit het keuzemenu daarna.
const pendingOsrsNames = new Map()

function setPendingOsrsName(discordUserId, osrsName) {
  if (osrsName) pendingOsrsNames.set(discordUserId, osrsName)
}

function consumePendingOsrsName(discordUserId) {
  const name = pendingOsrsNames.get(discordUserId)
  pendingOsrsNames.delete(discordUserId)
  return name
}

// Deze functie doet de daadwerkelijke aanmelding, en wordt zowel aangeroepen
// als er maar één actief event is (direct), als vanuit het keuzemenu
// (wanneer er meerdere events zijn) — zie index.js.
async function registerParticipant(interaction, eventId, eventName, osrsName) {
  const { data: existing } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('event_id', eventId)
    .eq('discord_id', interaction.user.id)
    .maybeSingle()

  if (existing) {
    return `Je bent al aangemeld voor **${eventName}**.`
  }

  let displayName = osrsName?.trim()

  // Geen naam opgegeven? Kijk of er een OSRS-naam op hun website-profiel staat.
  if (!displayName) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('osrs_username, username')
      .eq('discord_id', interaction.user.id)
      .maybeSingle()

    displayName = profile?.osrs_username || profile?.username || interaction.user.username
  }

  const { error } = await supabaseAdmin.from('participants').insert({
    event_id: eventId,
    discord_id: interaction.user.id,
    display_name: displayName,
    team_id: null,
  })

  if (error) {
    return 'Er ging iets mis bij het aanmelden. Probeer het later opnieuw.'
  }

  return `Je bent aangemeld voor **${eventName}** als **${displayName}**! Je verschijnt nu bij "Niet ingedeeld" — de organizer wijst je later in een team in.`
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aanmelden')
    .setDescription('Meld je aan voor een actief event van deze community')
    .addStringOption((option) =>
      option
        .setName('osrs-naam')
        .setDescription('Je in-game RuneScape naam (standaard: je naam uit je website-profiel, indien ingesteld)')
        .setRequired(false)
    ),

  registerParticipant,
  consumePendingOsrsName,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })

    const osrsName = interaction.options.getString('osrs-naam')

    // Welke community hoort bij deze Discord-server?
    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('id')
      .eq('discord_guild_id', interaction.guildId)
      .single()

    if (!community) {
      return interaction.editReply(
        'Deze Discord-server is nog niet gekoppeld aan een community. Vraag de eigenaar om /koppel-server uit te voeren.'
      )
    }

    // Welke events zijn nu actief?
    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('community_id', community.id)
      .eq('status', 'active')

    if (!events || events.length === 0) {
      return interaction.editReply('Er zijn nu geen actieve events om je voor aan te melden.')
    }

    // Eén actief event -> direct aanmelden, geen keuzemenu nodig
    if (events.length === 1) {
      const message = await registerParticipant(interaction, events[0].id, events[0].name, osrsName)
      return interaction.editReply(message)
    }

    // Meerdere actieve events -> laat de gebruiker kiezen (osrs-naam even onthouden)
    setPendingOsrsName(interaction.user.id, osrsName)

    const menu = new StringSelectMenuBuilder()
      .setCustomId('aanmelden_select_event')
      .setPlaceholder('Kies een event')
      .addOptions(events.map((e) => ({ label: e.name, value: e.id })))

    const row = new ActionRowBuilder().addComponents(menu)

    return interaction.editReply({
      content: 'Voor welk event wil je je aanmelden?',
      components: [row],
    })
  },
}
