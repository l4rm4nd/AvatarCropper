import { GifReader, GifWriter } from "./omggif.js";

var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
var frames = [];

function load(file, inputs) {
    var reader = new FileReader;
    reader.onloadend = function() {
        if (reader.error) {
            toast.show(_("Failed to load GIF frames."));
            return;
        }

        var view = new Uint8Array(reader.result);
        var gifReader;
        try {
            gifReader = new GifReader(view);
        }
        catch (e) {
            toast.show(_("Failed to load GIF frames: ") + e.message);
            return;
        }

        var { width, height } = gifReader;
        canvas.width = width;
        canvas.height = height;
        inputs.loopCount.value = gifReader.loopCount();

        var lastNoDisposeFrame;
        var clearBg;
        for (let i = 0; i < gifReader.numFrames(); ++i) {
            const info = gifReader.frameInfo(i);
            let inheritFrame;
            if (!clearBg) {
                if (info.disposal == 3)
                    inheritFrame = lastNoDisposeFrame;
                else if (info.disposal != 0 && i > 0)
                    inheritFrame = frames[i - 1].imageData;
            }
            else clearBg = false;
            
            let imageData;
            if (inheritFrame)
                imageData = new ImageData(new Uint8ClampedArray(inheritFrame.data), width, height);
            else
                imageData = ctx.createImageData(width, height);

            gifReader.decodeAndBlitFrameRGBA(i, imageData.data);
            
            if (info.disposal == 0)
                lastNoDisposeFrame = imageData;
            else if (info.disposal == 2)
                clearBg = true;

            frames[i] = { info, imageData };
        }

        var lastFrame = gifReader.numFrames() - 1;
        inputs.frame.min = 0;
        inputs.frame.max = lastFrame;
        inputs.frame.value = 0;
        inputs.frame.disabled = false;
        inputs.endFrame.value = lastFrame;
        inputs.keepGifColors.checked = true;
    }
    reader.readAsArrayBuffer(file);
}

function loadFrame(img, frameNum) {
    return new Promise(resolve => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(frames[frameNum].imageData, 0, 0);
        img.src = canvas.toDataURL();
        img.addEventListener("load", resolve, { once: true });
    });
}

function createFrame(px, palette, indexedPixels, keepGifColors) {
    palette.push(0); // transparent
    for (let i = 0; i < px.length; i += 4) {
        let r = px[i];
        let g = px[i+1];
        let b = px[i+2];
        let a = px[i+3];

        if (a == 0) {
            indexedPixels.push(0);
            continue;
        }

        let rgb = ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
        let index, lastDiff = null;
        for (let x = 1; x < palette.length; ++x) {
            // Find color in palette
            let prgb = palette[x];
            if (prgb == rgb) {
                index = x;
                lastDiff = null;
                break;
            }

            // Check if color is close
            if (!keepGifColors || palette.length == 256) {
                let pr = (prgb >> 16) & 0xff;
                let pg = (prgb >> 8) & 0xff;
                let pb = prgb & 0xff;
                let diff = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
                if (lastDiff == null || diff < lastDiff) {
                    index = x;
                    lastDiff = diff;
                }
            }
        }
        // Exponentially increase tolerance
        var tolerance = 15 + (40 * Math.pow(2, 10 * (palette.length / 256) - 10));
        if (palette.length != 256 && lastDiff > tolerance)
            index = null;

        if (!index)
            index = palette.push(rgb) - 1;
        
        indexedPixels.push(index);
    }

    if (palette.length == 256) return;
    // Palette length needs to be a power of 2
    // We do a *bit* of twiddling
    let v = palette.length; // max is 256 = 8 bits
    if (v < 2)
        v = 2
    else {
        --v;
        v |= v >> 1;
        v |= v >> 2;
        v |= v >> 4;
        ++v;
    }

    // Pad extra values
    let needed = v - palette.length;
    for (let i = 0; i < needed; ++i)
        palette.push(0);
}

function reset() {
    if (frames.length) {
        gif.frames = frames = [];
        return true;
    }
    return false;
}

function hasFrames() {
    return frames.length > 0;
}

var gif = {
    Writer: GifWriter,
    load,
    loadFrame,
    createFrame,
    reset,
    hasFrames,
    frames
}
export default gif;