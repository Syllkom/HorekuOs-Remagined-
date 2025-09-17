import datagame from '../source/datagame.js';

export default {
  command: true,
  case: ['balance', 'bal', 'cartera'],
  usePrefix: true,
  script: async (m) => {
    const jid = m.sender.id || m.sender;
    const user = datagame.getUser(jid);
    m.reply(
      `🧑 Usuario: ${jid}\n` +
      `💰 Monedas: ${user.coins}\n` +
      `💎 Gemas: ${user.gems}\n` +
      `🔝 Nivel: ${user.level} (${user.xp}/${user.xp_limit} XP)\n` +
      `🏅 Rango: ${user.rank}\n` +
      `🎖️ Títulos: ${user.titles.join(', ')}`
    );
  }
}