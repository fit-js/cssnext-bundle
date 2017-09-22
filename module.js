import path from 'path';
import core from 'fit-core';
import fs from 'fs';

import del from 'del';
import postcss from 'postcss';
import cssNext from 'postcss-cssnext';
import postCssImport from 'postcss-import';
import postCssExtend from 'postcss-extend';
import postCssNesting from 'postcss-nesting';
import cssNano from 'cssnano';

let develop, output, source, trigger, prefixer, clear;

export function init (config) {
	develop = core.args.env() === 'develop';

	// required
	output = config.output;
	source = config.source;
	trigger = config.trigger;

	// optional
	prefixer = config.autoprefixer_options;
	clear = config.clear || false;

	clean()
		.then (() => {
			return build();
		})
		.then (() => {
			let bs = core.globals.get('bs');

			if (develop && bs) {
				let watch_stuff = core.utils.filterNonExistingFiles (trigger);

				if (watch_stuff) {
					return bs.watch (trigger)
						.on ('change', build)
						.on ('unlink', clearOutput);
				} else {
					core.utils.error ('trigger', trigger);
				}
			}
		});
}

function clean () {
	if (clear !== undefined && clear === true) {
		del(['*.css'], { cwd: output });
	}
	return Promise.resolve();
}

function build () {
	let stream;
	let source_stuff = core.utils.filterNonExistingFiles (source);

	if (source_stuff) {
		if (source_stuff.length === 1) {
			let source = source_stuff[0];
			let source_output = path.join (output, path.posix.basename(source));

			fs.readFile(source, (err, contents) => {
				postcss([
					postCssImport({ addModulesDirectories: [
						'node_modules',
						path.dirname (source)
					]}),
					postCssNesting(),
					postCssExtend(),
					cssNext(prefixer),
					cssNano()
				])
					.process (contents, { to: source_output })
					.then(result => {
						fs.writeFileSync (source_output, result.css);
						return Promise.resolve (result);
					})
					.then(result => {
					// console.log(result);
						if (result.map) fs.writeFile (source_output +'.map', result.map);
					})
					.catch(e => {
						core.utils.error ('cssnext-bundle.build', '');
						console.log (e);
					});
			});
		} else {
			console.log('we do not support multiple entries for postcss');
		}
	} else {
		core.utils.error ('trigger', source);
	}

	return Promise.resolve(stream);
}

function clearOutput (file) {
	let name = path.basename(file, '.scss') + '.css';
	let stream;

	if (path.basename(file) === file) {
		stream = del(name, {
			cwd: output
		});
	}
	return Promise.resolve(stream);
}
