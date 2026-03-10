import { Collection } from 'discord.js';
import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import path from 'path';
import fs from 'fs';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Dynamically load all command files from the commands directory.
 * Returns a Collection of command names to command modules.
 */
export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname, '..', 'commands');

  const allFiles = fs.readdirSync(commandsPath);
  const jsFiles = allFiles.filter((file) => file.endsWith('.js') && !file.endsWith('.d.ts'));
  const tsFiles = allFiles.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));

  // Prefer JS when available (dist runtime), otherwise fallback to TS (ts-node runtime).
  const files = jsFiles.length > 0 ? jsFiles : tsFiles;

  for (const file of files) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = await import(filePath);
      
      if (command.data && command.execute) {
        commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.warn(`⚠️  Command file ${file} does not export data and execute`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error);
    }
  }

  if (commands.size === 0) {
    console.warn('⚠️  No commands were loaded!');
  }

  return commands;
}

/**
 * Register all commands with Discord.
 */
export async function registerCommands(
  commands: Collection<string, Command>,
  clientId: string,
  guildId: string
): Promise<void> {
  const { REST, Routes } = await import('discord.js');
  
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  const commandData = commands.map(cmd => cmd.data.toJSON());

  try {
    console.log(`🔄 Registering ${commandData.length} commands to Discord...`);
    
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandData
    });

    console.log(`✅ Successfully registered ${commandData.length} commands`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    throw error;
  }
}
