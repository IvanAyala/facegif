var GIFEncoder = require('gifencoder');
var Canvas = require('canvas');
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');

var size = 320;

var mediathek = '/Users/jewe/Pictures/Fotos-Mediathek.photoslibrary/';
var masters = mediathek + "Masters/";
var database = mediathek + "database/photos.db";

var name = "test";

var encoder = new GIFEncoder(size, size);
encoder.createReadStream().pipe(fs.createWriteStream(name + '.gif'));

encoder.start();
encoder.setRepeat(0);
encoder.setDelay(2000);
encoder.setQuality(100);

var canvas = new Canvas(size, size);
var ctx = canvas.getContext('2d');

var img = new Canvas.Image();

img.onload = function() {
    ctx.drawImage(img, 0, 0,5000,5000,0,0,320,320);
    encoder.addFrame(ctx);
    console.log("y")
    encoder.finish();
}

img.src = "/Users/jewe/Pictures/Fotos-Mediathek.photoslibrary/Masters/2017/01/10/20170110-131634/IMG_4163.JPG";

