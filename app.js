var Canvas = require('canvas');
var exec = require('child_process').exec;
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs-extra');
var argv = require('optimist')
    .default('d', 32)
    .default('s', 500)
    .default('l', 0)
    .default('z', 1.2)
    .default('f', 'gif')
    .describe('v', 'Set verbose output')
    .describe('f', 'Output format. Can be gif or mp4')
    .alias('z', 'zoom')
    .describe('z', 'Factor to zoom out from the face')
    .default('q', 100)
    .alias('q', 'quality')
    .describe('r', 'Rotate the image to level eyes')
    .describe('q', 'Image quality (0-100)')
    .alias('l', 'limit')
    .describe('l', 'Maximum number of frames')
    .alias('d', 'delay')
    .describe('d', 'Time between frames')
    .alias('s', 'size')
    .describe('s', 'Size of the output gif')
    .alias('n', 'name')
    .describe('n', 'The person from your Photos Library')
    .alias('o', 'out')
    .describe('o', 'Output file [default -n]')
    .demand(['n'])
    .argv;

var size = argv.s;

var startTime = Date.now();
var count = 0;

var appendix = '-tempcopy';

var mediathek = '/Users/jewe/Pictures/Fotos-Mediathek.photoslibrary/';
var masters = mediathek + "Masters/";
var database = mediathek + "database/photos.db";

fs.copySync(database, database + appendix);

database += appendix;

var name = argv.name;
var out = argv.out || name + '.gif';
var vout = argv.out || name + '.mp4';

var videoOptions = {
    fps: 60,
    videoCodec: 'libx264',
    transition: false,
    loop: argv.d / 1000,
    size: size + "x" + size,
    format: 'mp4',
    pixelFormat: 'yuv420p'
}

var processor = null;
var encoder = null;

var frames = [];
var tempDir = null

if (argv.f == "mp4") {

    var frames = [];
    tempDir = fs.mkdtempSync('/var/tmp/facegif_');

} else if (argv.f == "gif") {

    processor = require('gifencoder');
    encoder = new processor(size, size);
    encoder.createReadStream().pipe(fs.createWriteStream(out));

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(argv.d);
    encoder.setQuality(argv.q);

} else {
    console.error('Unknown format. Use gif or mp4.')
}

var canvas = new Canvas(size, size);
var ctx = canvas.getContext('2d');

var cleanup = function() {

    db.close();
    // if (argv.f == "mp4") {
    //     fs.remove(tempDir);
    // }
    fs.removeSync(database);
    fs.removeSync(database + '-shm');
    fs.removeSync(database + '-wal');
}

var finish = function() {
    var duration = (Date.now() - startTime) / 1000;
    process.stdout.write('\n');
    console.log("Finished " + count + " frames in " + duration.toFixed(2) + "s");
}

var db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, function(err) {
    if (err) {
        console.log(err)
        console.error("Error reading your Photos Mediathek.");
        cleanup();
        process.exit();
    }
});

var query = 'SELECT RKMaster.orientation, RKMaster.imagePath, RKFace.sourceWidth, RKFace.sourceHeight, RKVersion.fileName, RKFace.leftEyeX,RKFace.leftEyeY, RKFace.rightEyeX,RKFace.rightEyeY, RKFace.size, RKFace.centerX, RKFace.centerY';
query += ' FROM RKFace'
query += ' JOIN RKVersion ON RKVersion.modelId = RKFace.imageModelId'
query += ' JOIN RKPerson ON RKFace.personId = RKPerson.modelId'
query += ' JOIN RKMaster ON RKMaster.modelId = RKVersion.masterId'
query += ' WHERE RKMaster.duration IS NULL AND RKMaster.isInTrash = 0 AND RKPerson.name = "' + name + '"';

if (argv.l > 0) {
    query += ' LIMIT ' + argv.l;
}

db.each(query, function(err, row) {

        if (err) {
            console.error(err);
            return;
        }

        if (row.orientation != 1 && row.orientation != 6 && row.orientation != 8) {
            console.log("skipped frame for orientation " + row.orientation);
            console.log(path);
            return;
        }

        var path = masters + row.imagePath;

        var long_side = Math.max(row.sourceWidth, row.sourceHeight);
        var source_size = long_side * row.size * argv.z;

        var cx = row.centerX * row.sourceWidth;
        var cy = row.centerY * row.sourceHeight;
        var source_left = cx - source_size * .5;
        var source_top = row.sourceHeight - cy - source_size * .5;

        var angle = argv.r ? Math.atan2(row.rightEyeY - row.leftEyeY, row.rightEyeX - row.leftEyeX) : 0;

        if (row.orientation == 6) {
            cx = row.sourceHeight - row.centerY * row.sourceHeight;
            cy = (1 - row.centerX) * row.sourceWidth;
            source_top = cy - source_size * .5;
            source_left = cx - source_size * .5;
            angle += 90 * Math.PI / 180;
        } else if (row.orientation == 8) {
            cx = row.centerY * row.sourceHeight;
            cy = row.centerX * row.sourceWidth;
            source_top = cy - source_size * .5;
            source_left = cx - source_size * .5;
            angle -= 90 * Math.PI / 180;
        }

        try {
            var squid = fs.readFileSync(path);

            var img = new Canvas.Image;
            img.src = squid;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle);
            ctx.drawImage(img, source_left, source_top, source_size, source_size, -size * .5, -size * .5, size, size);
            ctx.restore();

            if (argv.f == 'gif') {
                encoder.addFrame(ctx);
            } else if (argv.f == 'mp4') {
                var idx = ("00" + count).substr(-3);
                var framePath = tempDir + '/' + "frame_" + idx + ".png";
                fs.writeFileSync(framePath, canvas.toBuffer());
                frames.push(framePath);
            }

            process.stdout.write(".");
            count++;
        } catch (e) {
            console.error(e)
            process.stdout.write("#");
        }


    },
    function() {

        if (argv.f == 'gif') {
            encoder.finish();
            cleanup();
            finish();

        } else if (argv.f == 'mp4') {

            var path = tempDir + "/frame_%03d.png";
            var s = argv.s + 'x' + argv.s;
            var fps = 29.43;
            var frameduration = 1000 / fps
            var imageframes = Math.ceil(argv.d / frameduration);
            var duration = (imageframes * count) / fps;

            var cmd = 'ffmpeg ';
                cmd += '-y ';
                cmd += '-i ' + path + ' ';
                cmd += '-c:v libx264 ';
                cmd += '-profile:v baseline ';
                cmd += '-level 3.0 ';
                cmd += '-pix_fmt yuv420p ';
                cmd += '-r 29.43 ';
                cmd += vout;

            console.log(cmd)

            exec(cmd, function(a, b, c) {
                cleanup();
                finish();
            });





        }

    });
