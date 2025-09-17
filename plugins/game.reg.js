import datagame from '../source/datagame.js';

export default {
  command: true,
  case: ['game.reg', 'registrar', 'rpgreg'],
  usePrefix: true,
  script: async (m) => {
    const jid = m.sender.id || m.sender;
    const user = datagame.getUser(jid);
    if (user.registered) {
      return m.reply('¡Ya estás registrado en el sistema RPG!');
    }
    datagame.register(jid);
    m.reply(`¡Felicidades! Has sido registrado en el RPG.\nPremio de bienvenida: +${datagame.exportData().users[jid].coins} monedas.\nTítulo exclusivo: "Pionero RPG"`);
  }
}