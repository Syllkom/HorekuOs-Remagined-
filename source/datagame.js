import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('./source/database/datagame.json');
const BACKUP_PATH = path.resolve('./source/database/datagame.backup.json');
const VERSION = 1;

// Balance y configuraciones
const MAX_LEVEL = 100;
const BASE_XP = 100;
const XP_GROWTH = 1.15;

const DAILY_REWARD_REGULAR = 100;
const DAILY_REWARD_REGISTERED = 150;
const WELCOME_BONUS = 500;
const EXCLUSIVE_TITLE = "Pionero RPG";

const DEFAULT_USER = {
  level: 1,
  xp: 0,
  xp_limit: BASE_XP,
  coins: 0,
  gems: 0,
  rank: "Novato",
  titles: ["Iniciado"],
  inventory: [],
  last_daily: 0,
  last_xp_claim: 0,
  registered: false,
  registration_date: 0,
  stats: {
    battles: 0,
    wins: 0,
    losses: 0,
  },
};

const DEFAULT_DATA = {
  version: VERSION,
  users: {}
};

class DataGame {
  constructor() {
    this.db = null;
    this.hooks = {};
    this.load();
  }

  // ---------------- CORE DB ----------------

  load() {
    if (!fs.existsSync(DB_PATH)) {
      this.db = { ...DEFAULT_DATA };
      this.save();
    } else {
      try {
        this.db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        this.migrate();
      } catch (e) {
        if (fs.existsSync(BACKUP_PATH)) {
          this.db = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf-8'));
        } else {
          this.db = { ...DEFAULT_DATA };
        }
        this.save();
      }
    }
  }

  save() {
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
      }
    } catch (e) {}
    fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2));
  }

  migrate() {
    if (!this.db.version || this.db.version < VERSION) {
      this.db.version = VERSION;
      this.save();
    }
  }

  // ---------------- USERS ----------------

  getUser(jid) {
    if (!jid) throw new Error("JID requerido");
    if (!this.db.users[jid]) {
      this.db.users[jid] = JSON.parse(JSON.stringify(DEFAULT_USER));
      this.save();
    }
    return this.db.users[jid];
  }

  resetUser(jid) {
    if (!jid) throw new Error("JID requerido");
    this.db.users[jid] = JSON.parse(JSON.stringify(DEFAULT_USER));
    this.save();
    this.fireHook('onResetUser', jid);
  }

  deleteUser(jid) {
    delete this.db.users[jid];
    this.save();
    this.fireHook('onDeleteUser', jid);
  }

  getAllUsers() {
    return Object.keys(this.db.users).map(jid => ({ jid, ...this.db.users[jid] }));
  }

  // ---------------- XP & NIVELES ----------------

  calcXpLimit(level) {
    if (level >= MAX_LEVEL) return 1e9; // Prácticamente no subirá más
    return Math.floor(BASE_XP * Math.pow(XP_GROWTH, level - 1));
  }

  addXp(jid, amount) {
    const user = this.getUser(jid);
    if (user.level >= MAX_LEVEL) return { leveledUp: false, level: user.level, xp: user.xp, xp_limit: user.xp_limit };
    user.xp += amount;
    let leveledUp = false;
    while (user.xp >= user.xp_limit && user.level < MAX_LEVEL) {
      user.xp -= user.xp_limit;
      user.level += 1;
      user.xp_limit = this.calcXpLimit(user.level);
      leveledUp = true;
      this.fireHook('onLevelUp', jid, user.level);
    }
    if (user.level >= MAX_LEVEL) user.xp = 0;
    this.save();
    return { leveledUp, level: user.level, xp: user.xp, xp_limit: user.xp_limit };
  }

  claimXp(jid, amount, cooldown = 60 * 60 * 1000) {
    // Cooldown default: 1 hora
    const user = this.getUser(jid);
    const now = Date.now();
    if (now - user.last_xp_claim < cooldown) {
      return { success: false, next: user.last_xp_claim + cooldown - now };
    }
    user.last_xp_claim = now;
    this.addXp(jid, amount);
    this.save();
    return { success: true, xp: user.xp, level: user.level };
  }

  // ---------------- RANKS & TITLES ----------------

  getRank(jid) {
    const user = this.getUser(jid);
    if (user.level >= 100) return "Leyenda";
    if (user.level >= 80) return "Maestro";
    if (user.level >= 60) return "Experto";
    if (user.level >= 40) return "Avanzado";
    if (user.level >= 20) return "Aprendiz";
    return "Novato";
  }

  updateRank(jid) {
    const user = this.getUser(jid);
    const oldRank = user.rank;
    const newRank = this.getRank(jid);
    if (oldRank !== newRank) {
      user.rank = newRank;
      this.fireHook('onRankChange', jid, newRank, oldRank);
      this.save();
    }
    return newRank;
  }

  addTitle(jid, title) {
    const user = this.getUser(jid);
    if (!user.titles.includes(title)) {
      user.titles.push(title);
      this.fireHook('onTitleAdded', jid, title);
      this.save();
    }
  }

  // ---------------- ECONOMÍA ----------------

  addCoins(jid, amount) {
    const user = this.getUser(jid);
    user.coins += amount;
    this.save();
    return user.coins;
  }

  addGems(jid, amount) {
    const user = this.getUser(jid);
    user.gems += amount;
    this.save();
    return user.gems;
  }

  claimDaily(jid) {
    const user = this.getUser(jid);
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    const amount = user.registered ? DAILY_REWARD_REGISTERED : DAILY_REWARD_REGULAR;
    if (now - user.last_daily < cooldown) {
      return { success: false, next: user.last_daily + cooldown - now };
    }
    user.last_daily = now;
    this.addCoins(jid, amount);
    this.save();
    this.fireHook('onDailyClaim', jid, amount);
    return { success: true, coins: user.coins, amount };
  }

  // ---------------- REGISTRO ----------------

  register(jid) {
    const user = this.getUser(jid);
    if (user.registered) return false;
    user.registered = true;
    user.registration_date = Date.now();
    this.addCoins(jid, WELCOME_BONUS);
    this.addTitle(jid, EXCLUSIVE_TITLE);
    this.save();
    this.fireHook('onRegister', jid);
    return true;
  }

  // ---------------- INVENTARIO ----------------

  addItem(jid, item) {
    const user = this.getUser(jid);
    user.inventory.push(item);
    this.save();
    this.fireHook('onItemAdded', jid, item);
  }

  removeItem(jid, item) {
    const user = this.getUser(jid);
    const index = user.inventory.indexOf(item);
    if (index > -1) {
      user.inventory.splice(index, 1);
      this.save();
      this.fireHook('onItemRemoved', jid, item);
      return true;
    }
    return false;
  }

  // ---------------- STATS ----------------

  addBattle(jid, win = false) {
    const user = this.getUser(jid);
    user.stats.battles += 1;
    if (win) user.stats.wins += 1;
    else user.stats.losses += 1;
    this.save();
  }

  // ---------------- RANKING GLOBAL ----------------

  getLeaderboard(sortBy = 'level', top = 10) {
    return Object.entries(this.db.users)
      .map(([jid, user]) => ({ jid, ...user }))
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, top);
  }

  // ---------------- ADMIN FUNCTIONS ----------------

  setUserField(jid, field, value) {
    const user = this.getUser(jid);
    user[field] = value;
    this.save();
  }

  addXpAdmin(jid, amount) {
    return this.addXp(jid, amount);
  }

  addCoinsAdmin(jid, amount) {
    return this.addCoins(jid, amount);
  }

  resetAllData() {
    this.db = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
    this.fireHook('onResetAll');
  }

  // ---------------- HOOKS Y EVENTOS ----------------

  on(hookName, callback) {
    if (!this.hooks[hookName]) this.hooks[hookName] = [];
    this.hooks[hookName].push(callback);
  }

  fireHook(hookName, ...args) {
    if (this.hooks[hookName]) {
      for (const cb of this.hooks[hookName]) {
        try { cb(...args); } catch (e) {}
      }
    }
  }

  // ---------------- BACKUP/MIGRACIÓN ----------------

  backup() {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
  }

  restoreBackup() {
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, DB_PATH);
      this.load();
      return true;
    }
    return false;
  }

  exportData() {
    return JSON.parse(JSON.stringify(this.db));
  }

  importData(json) {
    this.db = json;
    this.save();
  }

  // ---------------- UTIL ----------------

  getVersion() {
    return VERSION;
  }
}

const datagame = new DataGame();
export default datagame;