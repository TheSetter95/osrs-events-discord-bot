const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

// Is deze Discord-gebruiker owner/organizer van de community?
async function checkOrganizerPermission(discordUserId, communityId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('discord_id', discordUserId)
    .single()

  if (!profile) return false

  const { data: membership } = await supabaseAdmin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('profile_id', profile.id)
    .in('role', ['owner', 'organizer'])
    .maybeSingle()

  return !!membership
}

// Zoekt het team waar deze Discord-gebruiker zelf in zit, binnen een actief
// Ganzebord-event van deze community.
async function findOwnTeam(discordUserId, communityId) {
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('community_id', communityId)
    .eq('type', 'ganzebord')
    .eq('status', 'active')

  if (!events || events.length === 0) return null

  for (const event of events) {
    const { data: participant } = await supabaseAdmin
      .from('participants')
      .select('team_id')
      .eq('event_id', event.id)
      .eq('discord_id', discordUserId)
      .not('team_id', 'is', null)
      .maybeSingle()

    if (participant?.team_id) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id, name, can_roll')
        .eq('id', participant.team_id)
        .single()
      if (team) return team
    }
  }

  return null
}

// Doet de daadwerkelijke worp: normale worp vooruit, of (als er een strafworp
// klaarstaat) een worp achteruit. Zelfde logica als de "🎲 Gooi"-knop op de website.
async function rollForTeam(teamId) {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name, event_id, board_position, pending_penalty')
    .eq('id', teamId)
    .single()

  if (!team) return 'Team niet gevonden.'

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('config')
    .eq('id', team.event_id)
    .single()

  const boardSize = event?.config?.boardSize ?? 63
  const roll = Math.floor(Math.random() * 6) + 1
  const isPenaltyRoll = team.pending_penalty

  const newPosition = isPenaltyRoll
    ? Math.max(team.board_position - roll, 0)
    : Math.min(team.board_position + roll, boardSize)

  const updates = { board_position: newPosition }
  if (isPenaltyRoll) updates.pending_penalty = false

  const { error } = await supabaseAdmin.from('teams').update(updates).eq('id', team.id)
  if (error) return 'Er ging iets mis bij het bijwerken.'

  await supabaseAdmin.from('progress_updates').insert({
    event_id: team.event_id,
    participant_id: null,
    data: {
      team_id: team.id,
      roll,
      from: team.board_position,
      to: newPosition,
      method: isPenaltyRoll ? 'straf_zelf' : 'dobbelsteen',
    },
    source: 'discord_bot',
  })

  if (isPenaltyRoll) {
    return `💥 **${team.name}** gooide de strafworp: **${roll}** terug, staat nu op vak **${newPosition}/${boardSize}**.`
  }

  const finishText = newPosition >= boardSize ? ' 🏁 Gefinisht!' : ''

  const { data: tile } = await supabaseAdmin
    .from('board_tiles')
    .select('*')
    .eq('event_id', team.event_id)
    .eq('tile_number', newPosition)
    .maybeSingle()

  let tileText = ''
  if (tile) {
    tileText = `\n📜 **Opdracht op vak ${newPosition}:** ${tile.description}`
    if (tile.effect_type !== 'geen') {
      tileText += `\n➡️ Los dit op via de website (bij het team) om de straf toe te wijzen${
        tile.transferable ? ' — mag uitgedeeld worden aan een ander team' : ''
      }.`
    }
  }

  return `🎲 **${team.name}** gooide een **${roll}** en staat nu op vak **${newPosition}/${boardSize}**.${finishText}${tileText}`
}

// Toont een team-keuzemenu, of gooit meteen als er maar één team is (organizer-flow)
async function showTeamMenuOrRoll(interaction, eventId) {
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, board_position')
    .eq('event_id', eventId)

  if (!teams || teams.length === 0) {
    return interaction.editReply('Dit event heeft nog geen teams.')
  }

  if (teams.length === 1) {
    const message = await rollForTeam(teams[0].id)
    return interaction.editReply({ content: message, components: [] })
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('gooi_select_team')
    .setPlaceholder('Kies een team')
    .addOptions(teams.map((t) => ({ label: `${t.name} (vak ${t.board_position})`, value: t.id })))
  const row = new ActionRowBuilder().addComponents(menu)

  return interaction.editReply({ content: 'Voor welk team wil je gooien?', components: [row] })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gooi')
    .setDescription('Gooi met de dobbelsteen voor jouw team (of, als organizer, voor elk team)'),

  rollForTeam,
  showTeamMenuOrRoll,

  async execute(interaction) {
    // Geen ephemeral: dit mag iedereen in het kanaal zien
    await interaction.deferReply()

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

    const isOrganizer = await checkOrganizerPermission(interaction.user.id, community.id)

    if (isOrganizer) {
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, name')
        .eq('community_id', community.id)
        .eq('type', 'ganzebord')
        .eq('status', 'active')

      if (!events || events.length === 0) {
        return interaction.editReply('Er is nu geen actief Ganzebord-event.')
      }

      if (events.length > 1) {
        const menu = new StringSelectMenuBuilder()
          .setCustomId('gooi_select_event')
          .setPlaceholder('Kies een event')
          .addOptions(events.map((e) => ({ label: e.name, value: e.id })))
        const row = new ActionRowBuilder().addComponents(menu)
        return interaction.editReply({ content: 'Voor welk event wil je gooien?', components: [row] })
      }

      return showTeamMenuOrRoll(interaction, events[0].id)
    }

    // Geen organizer: zoek het eigen team van deze gebruiker
    const ownTeam = await findOwnTeam(interaction.user.id, community.id)

    if (!ownTeam) {
      return interaction.editReply(
        'Je bent geen deelnemer van een team in een actief Ganzebord-event (of je hebt geen rechten).'
      )
    }

    if (!ownTeam.can_roll) {
      return interaction.editReply(
        `Jullie team (**${ownTeam.name}**) is nog niet vrijgegeven om zelf te gooien. Vraag de organizer.`
      )
    }

    const message = await rollForTeam(ownTeam.id)
    return interaction.editReply(message)
  },
}
