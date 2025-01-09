// import chokidar from "chokidar"
// import {promises as fs} from "fs"

import type { Plugin } from 'vite';

import micromatch from 'micromatch';
import { createGenerateCss, parseAtoms, PrefixRules, Rules } from '../core/atomizer';
import { reset } from '../core/rules';

interface Config {
	include: string[];
	reset: string;
	rules: Rules;
	prefixRules: PrefixRules;
	preLoads: string[];
}

const WAVE_CSS = '@wave.css';
const VIRTUAL_PATH = '/' + WAVE_CSS;
const BUILD_PLACEHOLDER = `#--wave-css--{top:1}`;
const DEBOUNCE_TIMEOUT = 250;

const CONFIG: Config = {
	preLoads: ['**/*.html'],
	include: ['**/*.{svelte,tsx,jsx,vue,mdx,svx,html}'],
	reset,
	rules: {},
	prefixRules: {}
};

export const waveCSS = (config?: Partial<Config>): Plugin[] => {
	config = { ...CONFIG, ...config };

	let isHMR = false;
	let timestamp = Date.now();

	let configRoot = '';

	const servers = [];
	const entry: Record<string, string[]> = Object.create(null);

	const generateCss = createGenerateCss(config.rules, config.prefixRules);

	const checkTargetFile = (id: string) => {
		if (id.startsWith(configRoot)) {
			id = id.slice(configRoot.length);
		}
		return (config.include ?? []).some((glob) => micromatch.isMatch(id, glob));
	};

	const makeStyle = () => {
		const allAtoms = Object.values(entry).flat();
		const styles = generateCss([...new Set(allAtoms)]);
		return config.reset + styles.join('\n');
	};

	const invalidate = () => {
		// console.log("invalidate")

		for (const server of servers) {
			const mod = server.moduleGraph.getModuleById(VIRTUAL_PATH);
			if (!mod) {
				continue;
			}

			server.moduleGraph.invalidateModule(mod);

			server.ws.send({
				type: 'update',
				updates: [
					{
						acceptedPath: VIRTUAL_PATH,
						path: VIRTUAL_PATH,
						timestamp,
						type: 'js-update'
					}
				]
			});
		}
	};

	let timer: ReturnType<typeof setTimeout>;
	const debounceInvalidate = () => {
		clearTimeout(timer);
		timer = setTimeout(invalidate, DEBOUNCE_TIMEOUT);
	};

	return [
		{
			name: `${WAVE_CSS}:dev`,
			apply: 'serve',
			enforce: 'pre',

			configureServer: (_server) => {
				// glob을 위한 config.root
				configRoot = _server.config.root + '/';

				servers.push(_server);
				_server.middlewares.use((req, res, next) => {
					if (!isHMR && req.url && checkTargetFile(req.url)) {
						debounceInvalidate();
					}
					return next();
				});
			},

			buildStart: () => {
				// const {preLoads} = config
				//
				// const watcher = chokidar.watch(preLoads, {
				//   ignored: (path) => path.includes("node_modules")
				// })
				//
				// watcher.on("change", async (path) => {
				//   entry[path] = parseAtoms(await fs.readFile(path, "utf-8"))
				//   debounceInvalidate()
				// })
				//
				// watcher.on("ready", async () => {
				//   const watchedPaths = watcher.getWatched()
				//   // console.log("--- ready --")
				//   // console.log("watchedPaths", watchedPaths)
				//
				//   await Promise.all(Object.entries(watchedPaths)
				//     .map(([path, files]) => (files as string[])
				//       .map(file => path + "/" + file)
				//       .map(filepath => fs.readFile(filepath, "utf-8")
				//         .then(data => entry[filepath] = parseAtoms(data))))
				//     .flat(1))
				//
				//   debounceInvalidate()
				// })
			},

			resolveId: (id: string) =>
				id === WAVE_CSS || id === VIRTUAL_PATH ? VIRTUAL_PATH : undefined,

			load: (id: string) => {
				if (id === VIRTUAL_PATH) {
					return makeStyle();
				}
			},

			transform(code, id) {
				if (isHMR) return code;
				if (id === VIRTUAL_PATH) return code;
				if (!checkTargetFile(id)) return code;
				entry[id] = parseAtoms(code);
				timestamp = Date.now();
			},

			async handleHotUpdate({ file, read }) {
				if (!checkTargetFile(file)) return;
				isHMR = true;
				entry[file] = parseAtoms(await read());
				timestamp = Date.now();
				invalidate();
			}
		},
		{
			name: `${WAVE_CSS}:build`,
			apply: 'build',
			enforce: 'pre',

			resolveId: (id: string) =>
				id === WAVE_CSS || id === VIRTUAL_PATH ? VIRTUAL_PATH : undefined,
			load: (id: string) => (id === VIRTUAL_PATH ? BUILD_PLACEHOLDER : undefined),

			transform(code, id) {
				if (checkTargetFile(id)) {
					entry[id] = parseAtoms(code);
				}
				return undefined;
			},

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			generateBundle(
				options,
				bundle: Record<string, { fileName: string; type: string; source: string }>
			) {
				const waveCSS = makeStyle();
				for (const chunk of Object.values(bundle)) {
					if (chunk.type === 'asset' && typeof chunk.source === 'string') {
						chunk.source = chunk.source.replace(BUILD_PLACEHOLDER, waveCSS);
					}
				}
			}
		}
	];
};

export * from '../core/makeValue';
export * from '../core/rules';
export * from '../core/atomizer';
export * from '../core/const';
