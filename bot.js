const mineflayer = require('mineflayer');

let bot = null;
let reconnectTimeout = null;
let routineTimeout = null;
let shuttingDown = false;

const HOST = 'Qu4ntumPenguin.aternos.me';
const PORT = 28663;
const USERNAME = 'Raboot_356';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startRoutine(currentBot) {
    if (shuttingDown) return;

    async function routine() {
        if (shuttingDown) return;
        if (!bot || bot !== currentBot) return;
        if (!bot.entity) {
            routineTimeout = setTimeout(routine, 45000);
            return;
        }

        try {
            console.log('[NPC] Iniciando ciclo...');

            console.log(
                `[NPC] Posición: X=${bot.entity.position.x.toFixed(2)} ` +
                `Y=${bot.entity.position.y.toFixed(2)} ` +
                `Z=${bot.entity.position.z.toFixed(2)}`
            );

            const chestId = bot.registry.blocksByName.chest?.id;

            if (!chestId) {
                console.log('[NPC] No se encontró el bloque chest en el registro.');
            } else {
                const chestBlock = bot.findBlock({
                    matching: chestId,
                    maxDistance: 5
                });

                if (chestBlock) {
                    console.log('[NPC] Cofre encontrado.');

                    try {
                        const chest = await bot.openChest(chestBlock);

                        console.log('[NPC] Cofre abierto.');

                        await sleep(2000);

                        chest.close();

                        console.log('[NPC] Cofre cerrado.');
                    } catch (err) {
                        console.log(
                            `[NPC] Error interactuando con el cofre: ${err.message}`
                        );
                    }
                } else {
                    console.log(
                        '[NPC] No se detectó ningún cofre en un radio de 5 bloques.'
                    );
                }
            }

            /*
             * IMPORTANTE:
             * No hacemos ningún movimiento todavía.
             *
             * El error del servidor es:
             *
             * Invalid move player packet received
             *
             * Por eso primero comprobamos si el bot puede permanecer
             * conectado sin enviar saltos/movimientos artificiales.
             */

            console.log('[NPC] Ciclo terminado sin movimiento artificial.');

        } catch (err) {
            console.log(`[NPC] Error en el ciclo: ${err.message}`);
        }

        if (!shuttingDown && bot === currentBot) {
            routineTimeout = setTimeout(routine, 45000);
        }
    }

    routineTimeout = setTimeout(routine, 45000);
}

function createBot() {
    if (shuttingDown) return;

    console.log('[NPC] Creando conexión...');

    const options = {
        host: HOST,
        port: PORT,
        username: USERNAME,

        /*
         * false permite que Mineflayer detecte la versión.
         */
        version: false,

        /*
         * Evita intentar autenticar el bot mediante Microsoft.
         * Si tu servidor requiere otro sistema de autenticación,
         * habrá que configurarlo aparte.
         */
        auth: 'offline'
    };

    console.log('[NPC] Configuración:');
    console.log(`[NPC] Host: ${HOST}`);
    console.log(`[NPC] Puerto: ${PORT}`);
    console.log(`[NPC] Usuario: ${USERNAME}`);
    console.log(`[NPC] Versión: autodetect`);

    const currentBot = mineflayer.createBot(options);

    bot = currentBot;

    currentBot.once('login', () => {
        console.log('[NPC] Login recibido correctamente.');

        try {
            console.log(
                `[NPC] Protocolo utilizado: ${currentBot.version}`
            );
        } catch (err) {
            console.log('[NPC] No se pudo obtener la versión.');
        }
    });

    currentBot.once('spawn', () => {
        console.log('[NPC] Spawn recibido.');

        if (currentBot.entity) {
            console.log(
                `[NPC] Posición inicial: ` +
                `X=${currentBot.entity.position.x.toFixed(2)} ` +
                `Y=${currentBot.entity.position.y.toFixed(2)} ` +
                `Z=${currentBot.entity.position.z.toFixed(2)}`
            );
        }

        /*
         * Esperamos 10 segundos después del spawn antes de comenzar
         * cualquier actividad.
         */
        console.log(
            '[NPC] Esperando 10 segundos antes de iniciar la rutina...'
        );

        startRoutine(currentBot);
    });

    currentBot.on('kicked', (reason) => {
        console.log('[NPC] KICK recibido del servidor:');
        console.log(reason);
    });

    currentBot.on('error', (err) => {
        console.log('[NPC] ERROR:');
        console.log(err);
    });

    currentBot.on('end', (reason) => {
        console.log('[NPC] Conexión finalizada.');
        console.log(`[NPC] Razón: ${reason}`);

        /*
         * Cancelamos la rutina perteneciente a esta instancia.
         */
        if (routineTimeout) {
            clearTimeout(routineTimeout);
            routineTimeout = null;
        }

        if (bot === currentBot) {
            bot = null;
        }

        if (shuttingDown) return;

        if (reconnectTimeout) {
            return;
        }

        console.log('[NPC] Reconectando en 25 segundos...');

        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            createBot();
        }, 25000);
    });

    /*
     * Diagnóstico de movimiento.
     *
     * No modificamos el movimiento aquí.
     * Solamente mostramos información para saber si el servidor
     * expulsa al bot inmediatamente después de recibir movimiento.
     */
    currentBot.on('move', () => {
        if (!currentBot.entity) return;

        console.log(
            `[NPC] Movimiento detectado: ` +
            `X=${currentBot.entity.position.x.toFixed(3)} ` +
            `Y=${currentBot.entity.position.y.toFixed(3)} ` +
            `Z=${currentBot.entity.position.z.toFixed(3)}`
        );
    });
}

process.on('SIGINT', () => {
    console.log('[NPC] Cerrando bot...');

    shuttingDown = true;

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (routineTimeout) {
        clearTimeout(routineTimeout);
        routineTimeout = null;
    }

    if (bot) {
        bot.quit('Bot shutdown');
    }

    setTimeout(() => process.exit(0), 1000);
});

createBot();
