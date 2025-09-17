import datagame from '../source/datagame.js';

export default {
  command: true,
  case: ['claim', 'diario', 'daily'],
  usePrefix: true,
  script: async (m) => {
    const jid = m.sender.id || m.sender;
    const result = datagame.claimDaily(jid);
    if (result.success) {
      m.reply(`¡Has reclamado tu recompensa diaria!\n+${result.amount} monedas.\nTu saldo actual: ${result.coins} monedas.`);
    } else {
      const min = Math.ceil(result.next / 60000);
      m.reply(`Ya reclamaste tu recompensa diaria. Vuelve en ${min} minutos.`);
    }
  }
}