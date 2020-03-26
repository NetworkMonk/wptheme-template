/* jshint esversion: 6 */ 
/* jshint strict: false */ 
/* jshint unused: false */ 
/* jshint loopfunc: true */ 

const package = require('./package.json');
const theme = require('./theme.json');

const { watch, series, src, dest } = require('gulp');
const uglify = require('gulp-uglify');
const uglifycss = require('gulp-uglifycss');
const rename = require('gulp-rename');
const del = require('del');
const concat = require('gulp-concat');
const sass = require('gulp-sass');
const fs = require('fs');
const path = require('path');
const zip = require('gulp-zip');
const sourcemaps = require('gulp-sourcemaps');
const merge = require('merge-stream');
const gulpif = require('gulp-if');
const order = require('gulp-order');
const fileSep = path.sep;

sass.compiler = require('node-sass');

const themeBuildPath = 'debug' + fileSep + 'themes' + fileSep + theme.name + fileSep;
const minifyJs = false;
const sourceMaps = false;
const minifyCss = false;

// removeParentPath will remove the parent path from the string will trailing slash if it is present
function removeParentPath(path, searchPath) {
    if (path.indexOf(searchPath + fileSep) === 0) {
        path = path.substr((searchPath + fileSep).length);
    } else if (path.indexOf(searchPath) === 0) {
        path = path.substr(searchPath.length);
    }
    return path;
}

// getFolders will list all folders in the supplied directory
function getFolders(dir) {
    return fs.readdirSync(dir)
    .filter(function(file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
    });
}

// getFiles will get all files in the current directory
function getFiles(dir) {
    return fs.readdirSync(dir)
    .filter(function(file) {
        return fs.statSync(path.join(dir, file)).isFile();
    });   
}

// clean will delete all contents from the testing theme directory
function clean(cb) {
    del([themeBuildPath + '*'])
    .catch(function() {})
    .then(function() {
        cb();
    });
}

// buildphp will copy all the contents of the php directory into the testing theme directory
function buildphp() {
    const phpPath = 'src' + fileSep + 'php';

    return src(phpPath + '/**/*.*', {base: process.cwd()})
    .pipe(rename(function(path) {
        path.dirname = removeParentPath(path.dirname, phpPath);
    }))
    .pipe(dest(themeBuildPath));
}

// buildassets will copy all assets to the theme directory
function buildassets() {
    const assetPath = 'src' + fileSep + 'assets';

    return src(assetPath + '/**/*.*', {base: process.cwd()})
    .pipe(rename(function(path) {
        path.dirname = removeParentPath(path.dirname, assetPath);
    }))
    .pipe(dest(themeBuildPath + 'assets' + fileSep));
}

// buildjs will create all JavaScript packages, they will be minified if specified and source maps created
function buildjs(cb) {
    const jsPath = 'src' + fileSep + 'js';

    var folders = getFolders(jsPath);
    var streams = [];

    if (folders.length === 0) {
        cb();
        return;
    }

    folders.forEach(function(folder) {
        // We include all javascript files, ordered by the closest to the parent folder first
        streams.push(
            src(path.join(jsPath, folder, '**/*.js'), {base: process.cwd()})
            .pipe(order([
                path.join(jsPath, folder, '*.js'),
                '*.js',
                path.join(jsPath, folder, '*/*.js'),
                '*/*.js',
                path.join(jsPath, folder, '*/*/*.js'),
                '*/*/*.js',
                path.join(jsPath, folder, '*/*/*/*.js'),
                '*/*/*/*.js',
                path.join(jsPath, folder, '*/*/*/*/*.js'),
                '*/*/*/*/*.js',
                path.join(jsPath, folder, '*/*/*/*/*/*.js'),
                '*/*/*/*/*/*.js',
            ]))
            .pipe(gulpif(sourceMaps, sourcemaps.init()))
            .pipe(concat(folder + '.js'))
            .pipe(gulpif(minifyJs, uglify()))
            .pipe(rename(folder + '.min.js'))
            .pipe(gulpif(sourceMaps, sourcemaps.write()))
            .pipe(dest(themeBuildPath + 'assets' + fileSep + 'js' + fileSep))
        );
    });

    return merge(streams);
}

// buildsass will create all sass / css files
function buildsass(cb) {
    const sassPath = 'src' + fileSep + 'sass';

    var files = getFiles(sassPath);
    var streams = [];

    if (files.length === 0) {
        cb();
        return;
    }

    files.forEach(function(file) {
        streams.push(
            src(path.join(sassPath, file), {base: process.cwd()})
            .pipe(sass().on('error', sass.logError))
            .pipe(rename({extname: '.css'}))
            .pipe(rename(function(path) {
                path.dirname = removeParentPath(path.dirname, sassPath);
            }))
            .pipe(gulpif(minifyCss && (file !== 'style.scss'), uglifycss()))
            .pipe(dest(themeBuildPath))
        );
    });

    return merge(streams);
}

// livebuild will prompt a build whenever a change in the src directory is detected
function livebuild(cb) {
    watch('src/**/*.*', exports.build);
    cb();
}

// includedependencies will include all required dependencies from installed node modules
function includedependencies(cb) {
    var streams = [];

    // Include jQuery dependency
    streams.push(
        src([
            'node_modules/jquery/dist/jquery.min.js',
            'node_modules/jquery/dist/jquery.min.map',
        ], {base: process.cwd()})
        .pipe(rename(function(path) {
            path.dirname = '';
        }))
        .pipe(dest(themeBuildPath + 'assets' + fileSep + 'js' + fileSep))
    );

    // Include popper dependency
    streams.push(
        src([
            'node_modules/popper.js/dist/umd/popper.min.js',
            'node_modules/popper.js/dist/umd/popper.min.js.map',
        ], {base: process.cwd()})
        .pipe(rename(function(path) {
            path.dirname = '';
        }))
        .pipe(dest(themeBuildPath + 'assets' + fileSep + 'js' + fileSep))
    );

    // Include bootstrap dependency
    streams.push(
        src([
            'node_modules/bootstrap/dist/js/bootstrap.min.js',
            'node_modules/bootstrap/dist/js/bootstrap.min.js.map',
        ], {base: process.cwd()})
        .pipe(rename(function(path) {
            path.dirname = '';
        }))
        .pipe(dest(themeBuildPath + 'assets' + fileSep + 'js' + fileSep))
    );

    return merge(streams);
}

// bundle will create a zip file containing the theme in the out directory, this can be uploaded
// to a wordpress site as a new theme
function bundle() {
    return src(themeBuildPath + '**/*.*')
    .pipe(zip(theme.name + '-' + package.version + '.zip'))
    .pipe(dest('out' + fileSep));
}

// All exported gulp scripts are here, these can be called from the terminal
exports.clean = clean;
exports.build = series(clean, buildphp, buildassets, includedependencies, buildjs, buildsass);
exports.watch = series(exports.build, livebuild);
exports.bundle = series(exports.build, bundle);
