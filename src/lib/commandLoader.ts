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
 * Find all command files recursively in the commands directory.
 * Supports nested folder structure (e.g., gestion-fichas/, registro-sucesos/, tienda/, staff/).
 */
function findCommandFiles(commandsPath: string, ext: '.ts' | '.js'): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(commandsPath, { recursive: true, withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext) && !entry.name.endsWith('.d.ts')) {
      files.push(path.join(entry.parentPath || commandsPath, entry.name));
    }
  }
  
  return files;
}

/**
 * Dynamically load all command files from the commands directory (including nested folders).
 * Returns a Collection of command names to command modules.
 */
export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname, '..', 'commands');

  // Find all command files (recursively) - prefer .js (compiled) over .ts (source)
  const jsFiles = findCommandFiles(commandsPath, '.js');
  const tsFiles = findCommandFiles(commandsPath, '.ts');
  
  const files = jsFiles.length > 0 ? jsFiles : tsFiles;

  for (const filePath of files) {
    try {
      const command = await import(filePath);
      
      if (command.data && command.execute) {
        commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.warn(`⚠️  Command file ${filePath} does not export data and execute`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${filePath}:`, error);
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
