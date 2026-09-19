// Ce script enregistre les commandes slash (/rumeur, /annonce) sur ton serveur Discord.
// A lancer une seule fois (ou a chaque fois que tu modifies les commandes elles-memes) :
//   npm run deploy
//
// Il a besoin de DISCORD_TOKEN, CLIENT_ID et GUILD_ID dans ton fichier .env local.

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('rumeur')
    .setDescription('Envoyer une rumeur anonyme au Fifth Line (validee par le staff avant publication)'),

  new SlashCommandBuilder()
    .setName('annonce')
    .setDescription('[Staff] Publier une annonce officielle du Fifth Line dans le salon public'),
].map((command) => command.toJSON());

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    'Variables manquantes : vérifie que DISCORD_TOKEN, CLIENT_ID et GUILD_ID sont bien dans ton .env'
  );
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploiement de ${commands.length} commande(s) slash sur le serveur ${GUILD_ID}...`);

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log('Commandes déployées avec succès. Elles sont disponibles immédiatement sur ton serveur.');
  } catch (error) {
    console.error('Erreur pendant le déploiement des commandes :', error);
  }
})();
