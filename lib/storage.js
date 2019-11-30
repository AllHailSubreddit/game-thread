const { DATA_DIR } = process.env;

const fs = require("fs-extra");
const glob = require("globby");
const { resolve } = require("path");

const STORAGE_PATH = resolve(DATA_DIR);
const COMMON_GLOB_OPTIONS = {
  cwd: STORAGE_PATH,
  expandDirectories: false,
  onlyFiles: true,
};
const COMMON_JSON_FORMAT_OPTIONS = { spaces: 2 };

function createIdFilepath(id) {
  return resolve(STORAGE_PATH, `${id}.json`);
}

async function deleteById(id) {
  const filepath = createIdFilepath(id);
  await fs.remove(filepath);
}

async function getAll() {
  await fs.ensureDir(STORAGE_PATH);
  const filepaths = await glob(["*.json"], {
    ...COMMON_GLOB_OPTIONS,
    absolute: true,
  });
  return filepaths.length
    ? Promise.all(filepaths.map(filepath => fs.readJson(filepath)))
    : [];
}

async function getById(id) {
  const filepath = createIdFilepath(id);
  const exists = await fs.pathExists(filepath);
  return exists ? fs.readJson(filepath) : null;
}

async function listIds() {
  await fs.ensureDir(STORAGE_PATH);
  const filepaths = await glob(["*.json"], COMMON_GLOB_OPTIONS);
  return filepaths.map(filepath => filepath.slice(0, -5));
}

async function put(id, data) {
  const filepath = createIdFilepath(id);
  return fs.outputJson(filepath, data, COMMON_JSON_FORMAT_OPTIONS);
}

async function putIfExists(id, data) {
  const filepath = createIdFilepath(id);
  const exists = await fs.pathExists(filepath);
  if (exists) await fs.outputJson(filepath, data, COMMON_JSON_FORMAT_OPTIONS);
}

module.exports = {
  deleteById,
  getAll,
  getById,
  listIds,
  put,
  putIfExists,
};
