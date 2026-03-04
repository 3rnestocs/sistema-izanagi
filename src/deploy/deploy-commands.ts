import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import * as registro from '../commands/registro';
import * as invertirSp from '../commands/invertir_sp';
import * as comprar from '../commands/comprar';
import * as transferir from '../commands/transferir';
import * as registrarActividad from '../commands/registrar_actividad';
import * as aprobarRegistro from '../commands/aprobar_registro';

const commands = [
    registro.data.toJSON(),
    invertirSp.data.toJSON(),
    comprar.data.toJSON(),
    transferir.data.toJSON(),
    registrarActividad.data.toJSON(),
    aprobarRegistro.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log(`⏳ Iniciando el registro de ${commands.length} comandos...`);

        // Usamos el Application ID de tu panel de desarrollador
        const data: any = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID!, 
                process.env.GUILD_ID!
            ),
            { body: commands },
        );

        console.log(`✅ ¡Éxito! Se registraron ${data.length} comandos en el servidor.`);
    } catch (error) {
        console.error("❌ Error al desplegar comandos:", error);
    }
})();