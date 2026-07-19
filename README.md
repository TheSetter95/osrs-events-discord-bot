# OSRS Events Discord Bot

Deze bot hoort bij dezelfde Discord-applicatie die je in Deel A hebt aangemaakt
(Discord Developer Portal). Hij draait als apart programma, los van je website,
en praat met dezelfde Supabase-database.

## Stap 1 — Bot-gebruiker aanmaken in je bestaande Discord-applicatie

1. Ga naar https://discord.com/developers/applications
2. Open dezelfde applicatie die je bij Deel A hebt gemaakt
3. Ga naar het tabblad **Bot** in het linkermenu
4. Als er nog geen bot is: klik **Add Bot** (soms staat die er al automatisch)
5. Klik **Reset Token** (of **Copy**, als er al een zichtbaar is) en bewaar deze token
   ergens veilig — dit is je `DISCORD_BOT_TOKEN`. **Deel deze nooit met iemand.**
6. Onder **Privileged Gateway Intents**: voor deze bot hoef je niets aan te vinken
   (we gebruiken geen "Server Members Intent" of "Message Content Intent")

## Stap 2 — Application ID (Client ID) opzoeken

1. Ga naar het tabblad **General Information**
2. Kopieer de **Application ID** — dit is je `DISCORD_CLIENT_ID`

## Stap 3 — Bot uitnodigen op je test-Discord-server

1. Ga naar het tabblad **OAuth2** → **URL Generator**
2. Vink bij **Scopes** aan: `bot` en `applications.commands`
3. Vink bij **Bot Permissions** aan: `Send Messages` en `Use Slash Commands`
4. Kopieer de gegenereerde URL onderaan, plak die in je browser
5. Kies je (test-)Discord-server, klik **Autoriseren**

## Stap 4 — Je test-server ID opzoeken

1. In Discord: **Gebruikersinstellingen** → **Geavanceerd** → zet **Ontwikkelaarsmodus** aan
2. Rechtermuisklik op je servernaam (linksboven) → **Server-ID kopiëren**
3. Dit is je `DISCORD_GUILD_ID`

## Stap 5 — Environment variables instellen

1. Kopieer `.env.example` naar `.env`
2. Vul in:
   - `DISCORD_BOT_TOKEN` (Stap 1)
   - `DISCORD_CLIENT_ID` (Stap 2)
   - `DISCORD_GUILD_ID` (Stap 4)
   - `SUPABASE_URL` — zelfde als in je website's `.env.local`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → **service_role**
     key (dus NIET de anon/public key — deze is geheim!)

## Stap 6 — Installeren en commando's registreren

```bash
npm install
npm run deploy-commands
```

Je zou moeten zien: `Commando's geregistreerd voor je test-server (direct beschikbaar).`

## Stap 7 — Bot starten

```bash
npm start
```

Je zou moeten zien: `Ingelogd als JouwBotNaam#1234`

Laat dit venster gewoon openstaan — zodra je het sluit (Ctrl+C), gaat de bot offline.

## Stap 8 — Testen in Discord

1. In je Discord-server, typ `/koppel-server` — als je bent ingelogd op de website met
   hetzelfde Discord-account en owner bent van een community, zou je een
   bevestiging moeten krijgen
2. Zorg dat er een **actief** event is om je voor aan te melden. Dat kan nu nog alleen
   handmatig: ga in Supabase naar **Table Editor** → `events`, en zet bij je test-event
   de kolom `status` op `active` (in plaats van `draft`)
3. Typ in Discord `/aanmelden` — je zou een bevestiging moeten krijgen
4. Check op de website: ga naar de event-pagina → je zou jezelf nu bij
   **"Niet ingedeeld"** moeten zien staan

## Later: naar productie

Voor nu draai je de bot lokaal op je eigen computer (handig om te testen, maar hij is
alleen online zolang jouw terminal openstaat). Zodra alles werkt, zetten we hem op een
plek die 24/7 blijft draaien, zoals Railway of Fly.io — dat pakken we in een latere stap
samen op.
