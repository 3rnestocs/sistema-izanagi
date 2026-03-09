import 'dotenv/config';
import { loadCommands } from '../lib/commandLoader';

(async () => {
    try {
        if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
            throw new Error('❌ Missing required environment variables: DISCORD_TOKEN, CLIENT_ID, GUILD_ID');
        }

        // Load all commands dynamically
        const commands = await loadCommands();
        
        if (commands.size === 0) {
            throw new Error('❌ No commands were loaded');
        }

        // Use the same registration function
        const { REST, Routes } = await import('discord.js');
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        console.log(`⏳ Registering ${commands.size} commands to Discord...`);

        const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());
        
        const data: any = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commandData }
        );

        console.log(`✅ Successfully registered ${data.length} commands to guild`);
    } catch (error) {
        console.error("❌ Error deploying commands:", error);
        process.exit(1);
    }
})();
