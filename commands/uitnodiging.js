const { SlashCommandBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uitnodiging')
    .setDescription('Toon de uitnodigingslink om lid te worden van deze community op de website'),

  async execute(interaction) {
    // Ephemeral: alleen de aanvrager ziet de link, die kan hem daarna zelf delen
    await interaction.deferReply({ ephemeral: true })

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('id, slug, name')
      .eq('discord_guild_id', interaction.guildId)
      .single()

    if (!community) {
      return interaction.editReply(
        'Deze Discord-server is nog niet gekoppeld aan een community. Vraag de eigenaar om /koppel-server uit te voeren.'
      )
    }

    const hasPermission = await checkOrganizerPermission(interaction.user.id, community.id)
    if (!hasPermission) {
      return interaction.editReply('Alleen owners/organizers kunnen de uitnodigingslink opvragen.')
    }

    const websiteUrl = process.env.WEBSITE_URL
    if (!websiteUrl) {
      return interaction.editReply(
        'De bot weet niet waar de website staat (WEBSITE_URL ontbreekt). Vraag de beheerder van de bot om dit in te stellen.'
      )
    }

    const inviteLink = `${websiteUrl.replace(/\/$/, '')}/communities/${community.slug}/join`

    return interaction.editReply(
      `🔗 Uitnodigingslink voor **${community.name}**:\n${inviteLink}\n\nDeel deze link met wie je wil uitnodigen. Ze loggen in met Discord en worden automatisch lid.`
    )
  },
}
