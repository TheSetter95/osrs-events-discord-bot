const { supabaseAdmin } = require('./supabaseAdmin')

// Wordt elke 30 seconden aangeroepen vanuit index.js. Meldt elke nog-niet-gemelde,
// openstaande screenshot-inzending precies één keer (via notified_at).
async function checkPendingSubmissions(client) {
  const { data: pending, error } = await supabaseAdmin
    .from('item_submissions')
    .select('id, quantity, screenshot_url, team_id, requirement_id, submitted_by')
    .eq('source', 'screenshot')
    .eq('status', 'pending')
    .is('notified_at', null)

  if (error) {
    console.error('Fout bij ophalen openstaande meldingen:', error)
    return
  }

  if (!pending || pending.length === 0) return

  for (const submission of pending) {
    try {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('name, event_id')
        .eq('id', submission.team_id)
        .single()

      if (!team) continue

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('community_id, name')
        .eq('id', team.event_id)
        .single()

      if (!event) continue

      const { data: community } = await supabaseAdmin
        .from('communities')
        .select('notification_channel_id, slug')
        .eq('id', event.community_id)
        .single()

      if (!community?.notification_channel_id) {
        // Geen kanaal ingesteld -> markeer toch als "gemeld" zodat we niet blijven
        // proberen; de melding blijft gewoon zichtbaar op de website zelf.
        await supabaseAdmin
          .from('item_submissions')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', submission.id)
        continue
      }

      const { data: requirement } = await supabaseAdmin
        .from('board_tile_requirements')
        .select('item_name, required_quantity')
        .eq('id', submission.requirement_id)
        .single()

      const { data: submitterProfile } = await supabaseAdmin
        .from('profiles')
        .select('username, osrs_username')
        .eq('id', submission.submitted_by)
        .maybeSingle()

      const submitterName = submitterProfile?.osrs_username || submitterProfile?.username || 'Onbekend'

      const channel = await client.channels.fetch(community.notification_channel_id)

      await channel.send(
        `📸 **Nieuwe screenshot ter beoordeling** — ${event.name}\n` +
          `**${team.name}** meldt **${submission.quantity}x ${requirement?.item_name ?? 'item'}** ` +
          `(door ${submitterName})\n` +
          `${submission.screenshot_url}\n` +
          `Beoordeel op de website bij dit event.`
      )

      await supabaseAdmin
        .from('item_submissions')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', submission.id)
    } catch (err) {
      console.error('Kon melding niet versturen voor submission', submission.id, err)
    }
  }
}

module.exports = { checkPendingSubmissions }
