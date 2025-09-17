import datagame from '../source/datagame.js';

export default {
  command: true,
  case: ['inventario', 'inv', 'inventory'],
  usePrefix: true,
  script: async (m) => {
    const jid = m.sender.id || m.sender;
    const user = datagame.getUser(jid);
    const items = user.inventory;
    if (!items.length) {
      return m.reply('Tu inventario está vacío.');
    }
    m.reply(`Tu inventario:\n- ${items.join('\n- ')}`);
  }
}