const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } = require('discord.js');

// ===== CONFIG =====
const BOT_TOKEN = MTQ1MTMzOTI2MjYxNTA5MzM4Mg.GWUxPQ.TDa6GrSGLEVKPsalABID8jOLahoLoZmVMbmYtY; // <-- Paste your token
const GUILD_ID = 1472277307002589216;       // <-- Paste your server ID
const STAFF_APP_CHANNEL_ID = 1473081595945812049; // Staff app channel
// ==================

// Create the client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

let staffAppMessageId = null;

// Helper function to create Staff App Embed
function getStaffEmbed(isOpen) {
    if (isOpen) {
        return {
            title: "📝 Staff Application",
            description: "🟢 **Staff Applications are Open**",
            color: 0x57F287,
            fields: [
                {
                    name: "⚠️ Agreement",
                    value: "- Do **not ping anyone** asking for your application to be read.\n- Applications **will be reviewed within 24 hours**. Please be patient.\n- Ignoring this rule may result in your application being **denied or delayed**."
                }
            ],
            footer: { text: "Alaska Management – Fill out the form carefully and completely." }
        };
    } else {
        return {
            title: "📝 Staff Application",
            description: "🔴 **Staff Applications are Closed**",
            color: 0xE74C3C,
            fields: [
                {
                    name: "Notice",
                    value: "Staff applications are currently closed. Please check back later for updates."
                }
            ],
            footer: { text: "Alaska Management – Thank you for your interest in joining the team." }
        };
    }
}

// ===== Register slash commands =====
client.once('ready', async () => {
    console.log(`${client.user.tag} is online! Registering slash commands...`);

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    const commands = [
        { name: 'staffopen', description: 'Open staff applications' },
        { name: 'staffclose', description: 'Close staff applications' }
    ];

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log('Slash commands registered!');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
});

// ===== Handle slash commands =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const channel = interaction.guild.channels.cache.get(STAFF_APP_CHANNEL_ID);
    if (!channel) return interaction.reply({ content: "Staff application channel not found.", ephemeral: true });

    try {
        if (interaction.commandName === 'staffopen') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Submit Application")
                        .setStyle(ButtonStyle.Link)
                        .setURL("https://melon.ly/form/7429303261795979264")
                );

            if (staffAppMessageId) {
                const message = await channel.messages.fetch(staffAppMessageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [getStaffEmbed(true)], components: [row] });
                    return interaction.reply({ content: "Staff Application is now open! ✅", ephemeral: true });
                }
            }

            const sentMessage = await channel.send({ embeds: [getStaffEmbed(true)], components: [row] });
            staffAppMessageId = sentMessage.id;
            return interaction.reply({ content: "Staff Application is now open! ✅", ephemeral: true });
        }

        if (interaction.commandName === 'staffclose') {
            if (!staffAppMessageId) return interaction.reply({ content: "No staff application message found to close.", ephemeral: true });

            const message = await channel.messages.fetch(staffAppMessageId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [getStaffEmbed(false)], components: [] });
                return interaction.reply({ content: "Staff Application is now closed. 🔴", ephemeral: true });
            } else {
                return interaction.reply({ content: "Could not find the message to close.", ephemeral: true });
            }
        }
    } catch (err) {
        console.error('Error handling command:', err);
    }
});

// ===== Login =====
client.login(BOT_TOKEN).catch(err => console.error('Login failed:', err));
