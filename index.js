// Bot "The Fifth Line" - compte reseau social du serveur RP Off Campus / Briar University.
//
// Fonctionnalites :
//   /rumeur   -> n'importe qui peut soumettre une rumeur anonyme, envoyee au staff pour validation
//   /annonce  -> le staff publie directement un embed (annonce officielle) dans le salon public
//   Boutons "Valider" / "Refuser" dans le salon staff pour traiter les rumeurs soumises
//
// Aucune base de donnees n'est necessaire : la rumeur en attente vit entierement dans le message
// envoye au salon staff (texte + auteur), donc rien n'est perdu si le bot redemarre entre-temps.

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');

const {
  DISCORD_TOKEN,
  STAFF_CHANNEL_ID,
  PUBLIC_CHANNEL_ID,
  STAFF_ROLE_ID,
  RUMEURS_ROLE_ID,
} = process.env;

const FIFTH_LINE_COLOR = 0xc9184a;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/** Un membre peut valider/refuser des rumeurs et poster des annonces s'il est admin ou a le role staff. */
function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  return false;
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecte en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---- Commandes slash ----
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'rumeur') {
        const modal = new ModalBuilder().setCustomId('rumeur_modal').setTitle('Envoyer une rumeur au Fifth Line');

        const contentInput = new TextInputBuilder()
          .setCustomId('rumeur_content')
          .setLabel('Ta rumeur (restera anonyme)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setPlaceholder('Ex : Il parait que...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.commandName === 'annonce') {
        if (!isStaff(interaction.member)) {
          await interaction.reply({
            content: "Tu n'as pas la permission d'utiliser cette commande.",
            ephemeral: true,
          });
          return;
        }

        const modal = new ModalBuilder().setCustomId('annonce_modal').setTitle('Publier une annonce Fifth Line');

        const titleInput = new TextInputBuilder()
          .setCustomId('annonce_title')
          .setLabel('Titre')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(true);

        const bodyInput = new TextInputBuilder()
          .setCustomId('annonce_body')
          .setLabel('Contenu')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(2000)
          .setRequired(true);

        const imageInput = new TextInputBuilder()
          .setCustomId('annonce_image')
          .setLabel("URL d'image (optionnel)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(bodyInput),
          new ActionRowBuilder().addComponents(imageInput)
        );

        await interaction.showModal(modal);
        return;
      }
    }

    // ---- Soumission des formulaires (modals) ----
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'rumeur_modal') {
        const content = interaction.fields.getTextInputValue('rumeur_content');

        if (!STAFF_CHANNEL_ID) {
          await interaction.reply({
            content: "Le salon de validation staff n'est pas configure (STAFF_CHANNEL_ID). Previens un admin du bot.",
            ephemeral: true,
          });
          return;
        }

        const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);

        const reviewEmbed = new EmbedBuilder()
          .setColor(FIFTH_LINE_COLOR)
          .setTitle('🕵️ Nouvelle rumeur a valider')
          .setDescription(content)
          .addFields(
            { name: 'Soumise par', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
            { name: 'Statut', value: '🕐 En attente' }
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rumeur_approve').setLabel('Valider').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rumeur_reject').setLabel('Refuser').setStyle(ButtonStyle.Danger)
        );

        await staffChannel.send({ embeds: [reviewEmbed], components: [row] });

        await interaction.reply({
          content: 'Ta rumeur a ete envoyee au staff pour validation. Merci !',
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId === 'annonce_modal') {
        const title = interaction.fields.getTextInputValue('annonce_title');
        const body = interaction.fields.getTextInputValue('annonce_body');
        const image = interaction.fields.getTextInputValue('annonce_image');

        if (!PUBLIC_CHANNEL_ID) {
          await interaction.reply({
            content: "Le salon public n'est pas configure (PUBLIC_CHANNEL_ID). Previens un admin du bot.",
            ephemeral: true,
          });
          return;
        }

        const announceEmbed = new EmbedBuilder()
          .setColor(FIFTH_LINE_COLOR)
          .setAuthor({ name: 'The Fifth Line' })
          .setTitle(title)
          .setDescription(body)
          .setTimestamp();

        if (image) {
          announceEmbed.setImage(image);
        }

        const publicChannel = await client.channels.fetch(PUBLIC_CHANNEL_ID);
        await publicChannel.send({ embeds: [announceEmbed] });

        await interaction.reply({ content: 'Annonce publiee.', ephemeral: true });
        return;
      }
    }

    // ---- Boutons Valider / Refuser ----
    if (interaction.isButton()) {
      if (interaction.customId === 'rumeur_approve' || interaction.customId === 'rumeur_reject') {
        if (!isStaff(interaction.member)) {
          await interaction.reply({ content: "Tu n'as pas la permission de faire ca.", ephemeral: true });
          return;
        }

        const approved = interaction.customId === 'rumeur_approve';
        const originalEmbed = interaction.message.embeds[0];
        const rumeurText = originalEmbed?.description ?? '';

        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setColor(approved ? 0x57f287 : 0xed4245)
          .spliceFields(1, 1, {
            name: 'Statut',
            value: approved ? `✅ Validee par <@${interaction.user.id}>` : `❌ Refusee par <@${interaction.user.id}>`,
          });

        await interaction.update({ embeds: [updatedEmbed], components: [] });

        if (approved && PUBLIC_CHANNEL_ID) {
          const publicChannel = await client.channels.fetch(PUBLIC_CHANNEL_ID);

          const publicEmbed = new EmbedBuilder()
            .setColor(FIFTH_LINE_COLOR)
            .setAuthor({ name: 'The Fifth Line' })
            .setDescription(rumeurText)
            .setFooter({ text: 'Rumeur anonyme • a prendre avec des pincettes 👀' })
            .setTimestamp();

          await publicChannel.send({
            content: RUMEURS_ROLE_ID ? `<@&${RUMEURS_ROLE_ID}>` : undefined,
            embeds: [publicEmbed],
          });
        }
        return;
      }
    }
  } catch (error) {
    console.error('Erreur pendant le traitement d\'une interaction :', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(DISCORD_TOKEN);
