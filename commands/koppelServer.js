const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('koppel-server')
    .setDescription('Koppel deze Discord-server aan jouw community op het platform')
    .addStringOption((option) =>
      option
        .setName('community-slug')
        .setDescription('Slug van je community (alleen nodig als je er meerdere beheert)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })

    // Stap 1: is deze Discord-gebruiker bekend op het platform?
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('discord_id', interaction.user.id)
      .single()

    if (!profile) {
      return interaction.editReply(
        'Ik kan je niet vinden op het platform. Log eerst één keer in op de website met dit Discord-account.'
      )
    }

    // Stap 2: van welke communities is deze gebruiker owner?
    const { data: memberships } = await supabaseAdmin
      .from('community_members')
      .select('role, communities(id, name, slug)')
      .eq('profile_id', profile.id)
      .eq('role', 'owner')

    const ownedCommunities = (memberships ?? []).map((m) => m.communities)

    if (ownedCommunities.length === 0) {
      return interaction.editReply('Je bent geen eigenaar van een community op het platform.')
    }

    const slugOption = interaction.options.getString('community-slug')
    let community

    if (slugOption) {
      community = ownedCommunities.find((c) => c.slug === slugOption)
      if (!community) {
        return interaction.editReply(
          `Geen community gevonden met slug "${slugOption}" waar jij eigenaar van bent.`
        )
      }
    } else if (ownedCommunities.length === 1) {
      community = ownedCommunities[0]
    } else {
      const list = ownedCommunities.map((c) => `- ${c.name} (slug: ${c.slug})`).join('\n')
      return interaction.editReply(
        `Je beheert meerdere communities. Voer dit commando opnieuw uit met het "community-slug" veld ingevuld:\n${list}`
      )
    }

    // Stap 3: koppel deze Discord-server aan de community
    const { error } = await supabaseAdmin
      .from('communities')
      .update({ discord_guild_id: interaction.guildId })
      .eq('id', community.id)

    if (error) {
      return interaction.editReply('Er ging iets mis bij het koppelen. Probeer het later opnieuw.')
    }

    return interaction.editReply(
      `Gelukt! Deze Discord-server is nu gekoppeld aan community **${community.name}**.`
    )
  },
}
