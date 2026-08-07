const { SlashCommandBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meldingskanaal')
    .setDescription('Stel dit kanaal in voor meldingen over nieuwe screenshot-inzendingen (alleen owners)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('discord_id', interaction.user.id)
      .single()

    if (!profile) {
      return interaction.editReply('Je hebt nog geen account op de website. Log daar eerst in.')
    }

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('id, name')
      .eq('discord_guild_id', interaction.guildId)
      .single()

    if (!community) {
      return interaction.editReply(
        'Deze Discord-server is nog niet gekoppeld aan een community. Vraag de eigenaar om /koppel-server uit te voeren.'
      )
    }

    const { data: membership } = await supabaseAdmin
      .from('community_members')
      .select('role')
      .eq('community_id', community.id)
      .eq('profile_id', profile.id)
      .eq('role', 'owner')
      .maybeSingle()

    if (!membership) {
      return interaction.editReply('Alleen de owner van deze community mag het meldingskanaal instellen.')
    }

    const { error } = await supabaseAdmin
      .from('communities')
      .update({ notification_channel_id: interaction.channelId })
      .eq('id', community.id)

    if (error) {
      return interaction.editReply('Instellen mislukt: ' + error.message)
    }

    return interaction.editReply(
      `✅ Dit kanaal is ingesteld als meldingskanaal voor **${community.name}**. Nieuwe screenshot-inzendingen worden hier voortaan gemeld.`
    )
  },
}
