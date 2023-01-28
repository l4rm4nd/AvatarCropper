import loadingDialog from "./loading-dialog.js";
import pbfe from "./pbfe.js";
import toast from "./toast.js";
import welcomeScreen from "./welcome-screen.js";
import { _ } from "./i18n.js";
import gif from "./gif.js";
import colorPicker from "./color-picker.js";
import touchToMouseEvent from "./touch-to-mouse-event.js";

var container, box;
var innerBox, canvas, ctx;
var menuBox, inputs = {};
var notifBox;
var renderCanvas, renderCtx;
var previewBox, previewCanvases = [];
var saveAnchor = document.createElement("a");
var gifOptionsDialog;

var cropShapes = {
    CIRCLE: 1,
    SQUARE: 2,
    FREEFORM: 3
};
var cropShape = cropShapes.CIRCLE;

function init(_container) {
    container = _container;

    box = new pbfe.Flexbox;
    box.element.id = "editorBox";
    box.element.classList.add("hide");

    initInnerBox();
    initMenuBox();
    initNotifBox();
    initGifOptions();

    innerBox.addEventListener("mousedown", mouseDownListener);
    document.addEventListener("mousemove", mouseMoveListener);
    document.addEventListener("mouseup", mouseUpListener);
    document.addEventListener("blur", mouseUpListener);
    innerBox.addEventListener("wheel", wheelListener, { passive: true });

    if ("ontouchstart" in document) {
        innerBox.addEventListener("touchstart", touchStartListener, { passive: true });
        document.addEventListener("touchmove", touchMoveListener, { passive: true });
        document.addEventListener("touchend", touchEndListener, { passive: true });
    }

    document.addEventListener("keydown", keyDownListener);

    renderCanvas = document.createElement("canvas");
    renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });
}

function initInnerBox() {
    innerBox = new pbfe.Flexbox;
    innerBox.element.id = "editorInnerBox";
    innerBox.element.style.cursor = "grab";
    box.appendChild(innerBox);

    canvas = new pbfe.Canvas;
    canvas.element.id = "editorCanvas";
    innerBox.appendChild(canvas);

    ctx = canvas.getContext("2d");
    ctx.lineWidth = 1;

    var fullscreenBtn = new pbfe.Button("⛶");
    fullscreenBtn.element.classList.add("innerBoxBtn");
    fullscreenBtn.element.title = _("Toggle fullscreen");
    fullscreenBtn.element.style.right = "0";
    innerBox.appendChild(fullscreenBtn);

    var tutorialBtn = new pbfe.Button("?");
    tutorialBtn.element.classList.add("innerBoxBtn");
    tutorialBtn.element.title = _("Show tutorial");
    tutorialBtn.element.style.right = "2.5rem";
    innerBox.appendChild(tutorialBtn);

    fullscreenBtn.addEventListener("click", function() {
        if (document.fullscreenElement)
            document.exitFullscreen();
        else
            document.body.requestFullscreen();
    });

    initTutorialDialog();
    tutorialBtn.addEventListener("click", showTutorialDialog);

    previewBox = new pbfe.Widget;
    previewBox.element.id = "previewBox";

    for (let i = 0; i < 3; ++i) {
        let c = document.createElement("canvas");
        c.classList.add("image" + i);
        previewBox.element.appendChild(c);
        previewCanvases.push(c);
    }

    innerBox.appendChild(previewBox);
}

var tutorialDialog, demoVideo;
function initTutorialDialog() {
    tutorialDialog = new pbfe.Dialog(_("Tutorial"));
    tutorialDialog.element.style.textAlign = "center";
    container.appendChild(tutorialDialog);

    var text1 = new pbfe.Label(_("Drag the crop selector to move or resize it."));
    tutorialDialog.appendChild(text1);

    demoVideo = document.createElement("video");
    demoVideo.style.pointerEvents = "none";
    demoVideo.style.maxWidth = "100%";
    demoVideo.style.marginTop = "0.5rem";
    demoVideo.src = "./demo.mp4";
    demoVideo.loop = true;
    tutorialDialog.body.appendChild(demoVideo);

    var text2 = new pbfe.Label(_("Dragging anywhere outside of the crop selector will move the viewport. Use the mouse wheel or pinch the screen with two fingers to zoom in/out.\nOnce you're done, press the \"Save image...\" button to save your cropped image.\n\nYou may view this tutorial at any time by pressing the \"?\" button at the top right of the screen."));
    tutorialDialog.appendChild(text2);

    tutorialDialog.appendHideButton(_("OK"));
}

function showTutorialDialog() {
    demoVideo.play();
    tutorialDialog.show();
}

function initMenuBox() {
    colorPicker.init(container);

    menuBox = new pbfe.Flexbox;
    menuBox.element.id = "editorMenu";
    box.appendChild(menuBox);

    var saveBtn = createMenuButton(_("Save image..."));
    var saveGifBtn = createMenuButton(_("Save as GIF..."));
    var fitBtn = createMenuButton(_("Fit image to viewport"));
    var circleBtn = createMenuButton(_("Circle"), true, true);
    var squareBtn = createMenuButton(_("Square"), true);
    var freeformBtn = createMenuButton(_("Freeform"));

    menuBox.appendChildren([
        /* Save */
        createSectionTitle(_("Save")),
        saveBtn,
        saveGifBtn,

        /* Crop Area */
        createSectionTitle(_("Crop Area")),
        createMenuInput("width", _("Width"), "text", true),
        createMenuInput("height", _("Height"), "text", true),
        createMenuInput("xPos", _("X Pos"), "text", true),
        createMenuInput("yPos", _("Y Pos"), "text", true),
        createMenuInput("allowOffscreen", _("Allow offscreen"), "checkbox"),

        /* Crop Shape */
        createSectionTitle(_("Crop Shape")),
        circleBtn, squareBtn,
        freeformBtn,
        createMenuInput("showGuidelines", _("Show guidelines"), "checkbox"),
        createMenuInput("guideColor", _("Guidelines color"), "color"),

        /* Image */
        createSectionTitle(_("Image")),
        createMenuInput("flipH", _("Flip horizontally"), "checkbox"),
        createMenuInput("flipV", _("Flip vertically"), "checkbox"),
        createMenuInput("frame", _("Frame"), "range"),
        createMenuInput("playGif", _("Play GIF"), "checkbox"),
        createMenuInput("bgColor", _("Background color"), "color"),

        /* Viewport */
        createSectionTitle(_("Viewport")),
        createMenuInput("zoom", _("Zoom"), "range"),
        createMenuInput("scaleDevicePixel", _("Scale to device pixel"), "checkbox"),
        fitBtn,
        createMenuInput("showPreview", _("Show preview"), "checkbox")
    ]);

    /* Input defaults */
    inputs.frame.value = 0;
    inputs.frame.disabled = true;
    inputs.showPreview.checked = true;
    inputs.bgColor.style.backgroundColor = "rgba(255,255,255,0)";
    inputs.guideColor.style.backgroundColor = "rgb(255,255,0)";

    /* Other */
    var returnBtn = new pbfe.Button(_("Open another image"));
    returnBtn.element.id = "returnBtn";
    menuBox.appendChild(returnBtn);

    var hideBtn = new pbfe.Button(_("Hide panel"));
    hideBtn.element.id = "hideBtn";
    menuBox.appendChild(hideBtn);

    /* Events */
    returnBtn.addEventListener("click", function() {
        hide();
        welcomeScreen.show();
    });

    var innerStyle = innerBox.element.style;
    hideBtn.addEventListener("click", function() {
        if (innerStyle.width && innerStyle.height) {
            innerStyle.removeProperty("width");
            innerStyle.removeProperty("height");
            previewBox.element.classList.remove("panelHidden");
            hideBtn.text = _("Hide panel");
        }
        else {
            innerStyle.width = "100%";
            innerStyle.height = "100%";
            previewBox.element.classList.add("panelHidden");
            hideBtn.text = _("Show panel");
        }
    });

    inputs.width.addEventListener("input", function() {
        var value = parseInputValue(this);
        if (!value || value < 10) return;
        cropWidth = value;
        if (cropShape != cropShapes.FREEFORM) {
            inputs.height.value = value;
            cropHeight = value;
        }
        setCropSize(cropWidth, cropHeight);
        redrawCanvas();
    });

    inputs.height.addEventListener("input", function() {
        var value = parseInputValue(this);
        if (!value || value < 10) return;
        cropHeight = value;
        if (cropShape != cropShapes.FREEFORM) {
            inputs.width.value = value;
            cropWidth = value;
        }
        setCropSize(cropWidth, cropHeight);
        redrawCanvas();
    });

    inputs.xPos.addEventListener("input", function() {
        var value = parseInputValue(this);
        if (value === undefined) return;
        setCropPosition(value, cropY);
        redrawCanvas();
    });

    inputs.yPos.addEventListener("input", function() {
        var value = parseInputValue(this);
        if (value === undefined) return;
        setCropPosition(cropX, value);
        redrawCanvas();
    });

    prevShapeBtn = circleBtn.element;
    addShapeBtnHandler(circleBtn, cropShapes.CIRCLE);
    addShapeBtnHandler(squareBtn, cropShapes.SQUARE);
    addShapeBtnHandler(freeformBtn, cropShapes.FREEFORM);

    inputs.showGuidelines.addEventListener("change", redrawCanvas);

    inputs.flipH.addEventListener("change", redrawCanvas);
    inputs.flipV.addEventListener("change", redrawCanvas);

    var zoomDetents = createRangeDetents("zoomDetents", [50, 100, 200, 400]);
    var zoomInput = inputs.zoom;
    zoomInput.min = 10;
    zoomInput.max = 800;
    zoomInput.value = canvasScale;
    zoomInput.setAttribute("list", zoomDetents);
    zoomInput.addEventListener("input", function() {
        setCanvasScale(this.value / 100);
    });

    inputs.scaleDevicePixel.addEventListener("change", function() {
        setCanvasScale(canvasScale);
    });

    fitBtn.addEventListener("click", function() {
        fitImageToViewport();
    });

    inputs.showPreview.addEventListener("change", function(e) {
        if (this.checked) {
            previewBox.element.style.display = "block";
            redrawPreview();
        }
        else
            previewBox.element.style.display = "none";
    });

    inputs.frame.addEventListener("input", function() {
        if (gif.hasFrames()) {
            var value = this.value;
            img = gif.frames[value].bitmap;
            redrawCanvas();
            showNotification(_("Frame: ") + value);
        }
    });

    saveBtn.addEventListener("click", renderAndSaveImage);
    saveGifBtn.addEventListener("click", function() {
        if (isCanvasTainted()) {
            toast.show(_("Sorry, images loaded from an external source can't be exported as GIF. Please open a local file."));
            return;
        }
        gifOptionsDialog.show();
    });

    inputs.playGif.addEventListener("change", function() {
        if (gif.frames.length < 2) return;
        if (this.checked)
            playNextGifFrame();
    });

    inputs.bgColor.addEventListener("click", function() { colorPicker.show(this, canvas.element); });
    inputs.guideColor.addEventListener("click", function() { colorPicker.show(this, canvas.element); });
    inputs.bgColor.addEventListener("colorchange", redrawCanvas);
    inputs.guideColor.addEventListener("colorchange", redrawCanvas);
    menuBox.addEventListener("scroll", colorPicker.hide, { passive: true });
    canvas.element.addEventListener("edstatechange", redrawCanvas);
}

function playNextGifFrame() {
    if (!inputs.playGif.checked) return;
    var nextFrame = ++inputs.frame.value;
    if (nextFrame == gif.frames.length) {
        inputs.frame.value = nextFrame = 0;
    }
    var frame = gif.frames[nextFrame];
    img = frame.bitmap;
    redrawCanvas();
    setTimeout(playNextGifFrame, frame.info.delay * 10);
}

function createSectionTitle(text) {
    var title = new pbfe.Label(text);
    title.element.classList.add("sectionTitle");
    return title;
}

function createMenuInput(name, labelText, inputType, split) {
    if (!labelText) labelText = name;
    var label = new pbfe.Label(labelText);
    label.element.classList.add("menuInputBox");
    if (split) label.element.classList.add("split");

    var input;
    if (inputType == "color") {
        input = new pbfe.Widget;
        input.element.classList.add("cpButton");
    }
    else {
        input = new pbfe.Input(inputType);
        input.element.setAttribute("aria-label", labelText);
    }
    label.appendChild(input);
    inputs[name] = input.element;
    return label;
}

var prevShapeBtn;
function addShapeBtnHandler(button, value) {
    button.addEventListener("click", function() {
        if (cropShape == value) return;
        cropShape = value;
        if (value != cropShapes.FREEFORM)
            setCropSize(cropWidth, cropWidth);

        this.classList.add("chosen");
        prevShapeBtn.classList.remove("chosen");
        prevShapeBtn = this;
        redrawCanvas();
    });
}

function parseInputValue(el) {
    if (el.value == "") return;
    var value = Number(el.value);
    if (isNaN(value)) {
        showNotification(_("Invalid value"));
        return;
    }
    return value;
}

function createMenuButton(label, split, chosen) {
    var btn = new pbfe.Button(label);
    var classes = ["menuBtn"];
    if (split) classes.push("split");
    if (chosen) classes.push("chosen");
    btn.element.classList.add(...classes);
    return btn;
}

function createRangeDetents(id, values) {
    var detents = document.createElement("datalist");
    detents.id = id;
    for (let i = 0; i < values.length; ++i) {
        let option = document.createElement("option");
        option.value = values[i];
        detents.appendChild(option);
    }
    document.body.appendChild(detents);
    return id;
}

function initNotifBox() {
    notifBox = new pbfe.Floatbox;
    notifBox.element.id = "notifBox";
    box.appendChild(notifBox);
}

var notifTimeout = null;
function showNotification(text, time) {
    if (notifTimeout != null) clearTimeout(notifTimeout);
    if (!time) time = 1000;
    var notifEl = notifBox.element;
    notifEl.innerText = text;
    notifEl.classList.add("show");

    notifTimeout = setTimeout(function() {
        notifEl.classList.remove("show");
        notifTimeout = null;
    }, time);
}

function initGifOptions() {
    gifOptionsDialog = new pbfe.Dialog(_("GIF Options"));
    gifOptionsDialog.appendChildren([
        createMenuInput("startFrame", _("Start frame"), "number"),
        createMenuInput("endFrame", _("End frame"), "number"),
        createMenuInput("loopCount", _("Loop count"), "number"),
        createMenuInput("speedMult", _("Speed multiplier"), "number"),
        createMenuInput("keepGifColors", _("Keep original colors"), "checkbox")
    ]);

    inputs.startFrame.value = inputs.startFrame.min = 0;
    inputs.endFrame.value = inputs.endFrame.min = 0;
    inputs.loopCount.value = inputs.loopCount.min = 0;
    inputs.speedMult.value = 1;
    inputs.speedMult.step = 0.25;
    inputs.speedMult.min = 0;

    inputs.keepGifColors.style.paddingTop = "0";
    
    var saveBtn = new pbfe.Button(_("Save"));
    gifOptionsDialog.appendButton(saveBtn);
    saveBtn.addEventListener("click", function() {
        hideGifOptions();
        renderAndSaveGif();
    });

    gifOptionsDialog.appendHideButton(_("Cancel"));

    container.appendChild(gifOptionsDialog);
}

function hideGifOptions() {
    gifOptionsDialog.hide();
}

var img;
var usingObjectUrl = false;
var currentName;
function open(src, successCb) {
    if (usingObjectUrl) {
        URL.revokeObjectURL(img.src);
        usingObjectUrl = false;
    }
    if (gif.reset()) {
        inputs.frame.value = 0;
        inputs.frame.disabled = true;
        inputs.startFrame.value = 0;
        inputs.endFrame.value = 0;
        inputs.loopCount.value = 0;
        inputs.keepGifColors.checked = false;
        inputs.playGif.checked = false;
    }

    loadingDialog.setProgress(-1);
    loadingDialog.show();

    if (src instanceof File) {
        currentName = src.name.slice(0, src.name.lastIndexOf("."));
        if (src.type == "image/gif") gif.load(src, inputs);
        src = URL.createObjectURL(src);
        usingObjectUrl = true;
    }
    else {
        if (src == "") return;
        if (img && src == img.src) {
            loadingDialog.hide();
            show();
            reset();
            successCb();
            return;
        }
        currentName = src.slice(src.lastIndexOf("/") + 1, src.lastIndexOf("."));
    }

    if (!(img instanceof Image)) img = new Image;
    var loadCb, errorCb
    img.addEventListener("load", loadCb = function() {
        loadingDialog.setProgress(1);
        loadingDialog.hide();

        canvas.element.width = img.width;
        canvas.element.height = img.height;

        show();
        reset();
        successCb();

        img.removeEventListener("load", loadCb);
        img.removeEventListener("error", errorCb);
    });
    img.addEventListener("error", errorCb = function() {
        loadingDialog.hide();
        toast.show(_("Failed to load image."));

        img.removeEventListener("load", loadCb);
        img.removeEventListener("error", errorCb);
    });
    img.src = src;
}

function show() {
    container.appendChild(box);
    setTimeout(function() { box.element.classList.remove("hide"); }, 0);

    if (!localStorage.getItem("tutorialShown")) {
        showTutorialDialog();
        localStorage.setItem("tutorialShown", "true");
    }
}

function hide() {
    box.element.classList.add("hide");
    container.removeChildAfterTransition(box);
    colorPicker.hide();
}

function isHidden() {
    return box.element.classList.contains("hide");
}

function reset() {
    fitImageToViewport();
    resetCropArea();

    inputs.flipH.checked = inputs.flipV.checked = false;
    redrawCanvas();
}

function resetCropArea() {
    var s = Math.floor((img.width < img.height ? img.width : img.height) * 0.5);
    s -= s % 10;
    
    cropX = cropY = 0;
    setCropSize(s, s);
    setCropPosition(0, 0);
}

function fitImageToViewport() {
    var innerEl = innerBox.element;
    var vpWidth = innerEl.offsetWidth;
    var vpHeight = innerEl.offsetHeight;
    var vpAspectRatio = vpWidth / vpHeight;
    var imgAspectRatio = img.width / img.height;

    var ratio = inputs.scaleDevicePixel.checked ? 1 : devicePixelRatio;
    setCanvasScale((vpAspectRatio > imgAspectRatio ? vpHeight / img.height : vpWidth / img.width) * ratio);
    setCanvasMargins(0, 0);
}

function setCropPosition(x, y) {
    if (!inputs.allowOffscreen.checked) {
        x = Math.max(0, Math.min(x, img.width - cropWidth));
        y = Math.max(0, Math.min(y, img.height - cropHeight));
    }

    cropX = x;
    cropY = y;
    inputs.xPos.value = x;
    inputs.yPos.value = y;
}

function setCropSize(width, height, preferHigher) {
    if (!inputs.allowOffscreen.checked) {
        width = Math.min(width, img.width - cropX);
        height = Math.min(height, img.height - cropY);
    }
    var min = (img.width < 50 || img.height < 50) ? 1 : 10;
    width = Math.max(min, width);
    height = Math.max(min, height);

    if (cropShape != cropShapes.FREEFORM) {
        if (preferHigher ? width > height : width < height) height = width;
        else width = height;
    }
    cropWidth = width;
    cropHeight = height;
    inputs.width.value = width;
    inputs.height.value = height;
}

var canvasX = 0, canvasY = 0;
function setCanvasMargins(x, y) {
    canvasX = x;
    canvasY = y;

    var canvasEl = canvas.element;
    canvasEl.style.marginLeft = canvasX + "px";
    canvasEl.style.marginTop  = canvasY + "px";
}

var canvasScale = 1;
function setCanvasScale(scale) {
    var ratio = inputs.scaleDevicePixel.checked ? 1 : devicePixelRatio;
    scale = Math.round(Math.max(0.1, Math.min(scale, 8)) * 1000) / 1000;
    var realScale = scale / ratio;
    canvas.element.style.transform = "scale(" + realScale.toFixed(3) + ")";
    inputs.zoom.value = Math.round(scale * 100);

    var newLineWidth = Math.ceil(Math.max(1, 1 / (realScale * devicePixelRatio)));
    if (newLineWidth != ctx.lineWidth) {
        ctx.lineWidth = newLineWidth;
        redrawCanvas();
    }

    var mScale = scale / canvasScale;
    setCanvasMargins(canvasX * mScale, canvasY * mScale);

    canvasScale = scale;
    showNotification(_("Zoom: ") + (+(scale*100).toFixed(1)) + "%");
}

function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function applyFlipTransform(canvas, ctx) {
    var flipH = inputs.flipH.checked;
    var flipV = inputs.flipV.checked;
    var sx = 1, sy = 1;
    if (flipH) {
        ctx.translate(canvas.width, 0);
        sx = -1;
    }
    if (flipV) {
        ctx.translate(0, canvas.height);
        sy = -1;
    }
    ctx.scale(sx, sy);
}

var frameRequested;
var cropX = 0, cropY = 0, cropWidth = 0, cropHeight = 0;
function draw() {
    var canvasEl = canvas.element;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (!colorPicker.isEyeDropperActive()) {
        ctx.globalCompositeOperation = "source-over";
        // Draw the shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

        // Draw the crop selector
        var lw = ctx.lineWidth;
        var x = cropX - lw/2,
            y = cropY - lw/2,
            width = cropWidth + lw,
            height = cropHeight + lw;

        ctx.strokeStyle = "#ffffff";
        if (cropShape == cropShapes.CIRCLE) {
            ctx.strokeRect(x, y, width, height);
            let cx = cropX + width/2;
            let cy = cropY + height/2;

            ctx.beginPath();
            var hlw = lw/2;
            ctx.arc(cx - hlw, cy - hlw, width/2 - hlw, 0, 2 * Math.PI);
        }
        else {
            ctx.beginPath();
            ctx.rect(x, y, width, height);
        }

        // Save the path, draw the outline, then poke the hole
        ctx.save();
        ctx.stroke();
        ctx.restore();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000000";
        ctx.fill();

        // Draw guidelines
        if (inputs.showGuidelines.checked) {
            ctx.globalCompositeOperation = "source-over";
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = inputs.guideColor.style.backgroundColor;

            var prevLw = ctx.lineWidth;
            ctx.lineWidth += 1 + Math.floor((cropWidth * cropHeight) / 1000000);

            let cx = cropX + cropWidth/2;
            let cy = cropY + cropHeight/2;
            let right = cropX + cropWidth;
            let bottom = cropY + cropHeight;

            drawLine(cx, cy, cx, cropY); // top
            drawLine(cx, cy, cropX, cy); // left
            drawLine(cx, cy, cx, bottom); // bottom
            drawLine(cx, cy, right, cy); // right

            ctx.setLineDash([]);
            ctx.lineWidth = prevLw;
        }
    }

    // Draw image behind crop selector and shadow
    ctx.globalCompositeOperation = "destination-over";
    applyFlipTransform(canvasEl, ctx);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.resetTransform();

    ctx.fillStyle = inputs.bgColor.style.backgroundColor;
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    if (inputs.showPreview.checked)
        drawPreview();

    frameRequested = false;
}

function drawPreview() {
    var firstCanvas = previewCanvases[0];
    render(firstCanvas);
    for (let i = 1; i < previewCanvases.length; ++i) {
        let canvas = previewCanvases[i];
        let ctx = canvas.getContext("2d");
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(firstCanvas, 0, 0);
    }
}

function redrawCanvas() {
    if (frameRequested) return;
    window.requestAnimationFrame(draw);
    frameRequested = true;
}

function redrawPreview() {
    window.requestAnimationFrame(drawPreview);
}

function isCanvasTainted() {
    try {
        ctx.getImageData(0, 0, 1, 1);
        return false;
    }
    catch (err) {
        return true;
    }
}

function getRenderPos() {
    var flipH = inputs.flipH.checked;
    var flipV = inputs.flipV.checked;
    let x = cropX, y = cropY;
    if (flipH) x = (img.width - cropWidth) - x;
    if (flipV) y = (img.height - cropHeight) - y;
    return [x, y];
}

function render(canvas) {
    if (!canvas) canvas = renderCanvas;
    let ctx = canvas.getContext("2d");
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.fillStyle = inputs.bgColor.style.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    applyFlipTransform(canvas, ctx);
    let [x, y] = getRenderPos();
    ctx.drawImage(img,
        x, y, cropWidth, cropHeight, // Crop
        0, 0, cropWidth, cropHeight  // Placement
    );
    ctx.resetTransform();
}

function saveFile(href, filename) {
    saveAnchor.href = href;
    saveAnchor.download = filename;
    saveAnchor.click();
}

function renderAndSaveImage() {
    render();
    
    try {
        renderCanvas.toBlob(function(blob) {
            var url = URL.createObjectURL(blob);
            saveFile(url, currentName + "_cropped.png");
            setTimeout(function() {
                URL.revokeObjectURL(url);
            }, 0);
        });
    }
    catch {
        // Canvas tainted, use fallback
        showFallbackSaveDialog();
    }
}

async function renderAndSaveGif() {
    var renderer = new gif.Renderer(cropWidth, cropHeight, { loop: Math.floor(inputs.loopCount.value) });

    var frames = gif.frames;
    var lastFrame = frames.length ? frames.length - 1 : 0;
    var start = Math.max(0, Math.min(Math.floor(inputs.startFrame.value), lastFrame));
    var length = Math.max(0, Math.min(Math.floor(inputs.endFrame.value), lastFrame)) + 1;

    loadingDialog.setProgress(0);
    loadingDialog.show();
    var keepColors = inputs.keepGifColors.checked;
    var speedMult = +inputs.speedMult.value;
    for (let i = start; i < length; ++i) {
        // Allow rendering static image
        let delay = 0;
        if (frames.length) {
            var frame = frames[i];
            img = frame.bitmap;
            delay = speedMult ? frame.info.delay / speedMult : 0;
        }
        render();

        let imageData = renderCtx.getImageData(0, 0, cropWidth, cropHeight);
        renderer.addFrame(imageData, { delay, keepColors });
        loadingDialog.setProgress((i + 1) / length);
    }
    
    renderer.end();
    loadingDialog.hide();

    var uArray = renderer.getUint8Array();
    var blob = new Blob([uArray], {type: "image/gif"});
    var url = URL.createObjectURL(blob);
    saveFile(url, currentName + "_cropped.gif");
    setTimeout(function() {
        URL.revokeObjectURL(url);
    }, 0);

    // Reload current frame
    if (frames.length) img = frames[inputs.frame.value].bitmap;
}

var fbSaveInitialized = false;
var fbSaveDialog, fbSaveCanvas;
function showFallbackSaveDialog() {
    if (!fbSaveInitialized) {
        fbSaveDialog = new pbfe.Dialog(_("Save image"));
        fbSaveDialog.element.style.textAlign = "center";
        fbSaveDialog.appendHideButton(_("OK"));
        container.appendChild(fbSaveDialog);

        var label = new pbfe.Label(_("Right click on the image and choose Save image as...\n"));
        fbSaveDialog.appendChild(label);

        fbSaveCanvas = document.createElement("canvas");
        fbSaveCanvas.id = "fbSaveCanvas";
        fbSaveDialog.body.appendChild(fbSaveCanvas);

        fbSaveInitialized = true;
    }

    render(fbSaveCanvas);
    fbSaveDialog.show();
}

var isInSelection = false;
var isResizing = false;
var resizeFromLeft = false;
var resizeFromTop = false;
function checkMousePos(e) {
    if (colorPicker.isEyeDropperActive()) {
        innerBox.element.style.cursor = "default";
        return;
    }

    var rect = canvas.element.getBoundingClientRect();
    // canvas rect -> selection rect
    rect.x += rect.width * (cropX / img.width);
    rect.y += rect.height * (cropY / img.height);
    rect.width *= cropWidth / img.width;
    rect.height *= cropHeight / img.height;

    var cursor;
    isInSelection = isPointInRect(e.clientX, e.clientY, rect);
    if (isInSelection && !touchPinching) {
        var cx = rect.x + rect.width/2;
        var cy = rect.y + rect.height/2;
        isResizing = !isPointInCircle(e.clientX, e.clientY, cx, cy, rect.width / 2);
        if (isResizing) {
            resizeFromLeft = e.clientX < cx;
            resizeFromTop = e.clientY < cy;
            if (resizeFromTop) {
                if (resizeFromLeft) cursor = "nw-resize";
                else cursor = "ne-resize";
            }
            else {
                if (resizeFromLeft) cursor = "sw-resize";
                else cursor = "se-resize";
            }
        }
        else cursor = "move";
    }
    else cursor = "grab";

    innerBox.element.style.cursor = cursor;
}

var mouseDown = false;
function mouseDownListener(e) {
    if (isHidden() || e.button != 0) return;
    if (colorPicker.isEyeDropperActive()) {
        var canvasEl = canvas.element;
        var rect = canvasEl.getBoundingClientRect();
        var detail = { mode: "rgb" };
        if (!isPointInRect(e.clientX, e.clientY, rect)) {
            // color of the outer area...lol
            detail.color = [30, 30, 30, 255];
        }
        else {
            var x = ((e.clientX - rect.x) / rect.width) * canvasEl.width;
            var y = ((e.clientY - rect.y) / rect.height) * canvasEl.height;
            var imageData = ctx.getImageData(x, y, 1, 1);
            detail.color = imageData.data;
        }

        canvasEl.dispatchEvent(new CustomEvent("eyedrop", { detail }));
    }

    checkMousePos(e);
    if (!isInSelection)
        innerBox.element.style.cursor = "grabbing";

    mouseDown = true;
}

var prevX = null, prevY = null;
function mouseMoveListener(e) {
    if (isHidden()) return;
    if (!mouseDown) {
        checkMousePos(e);
        return;
    }

    if (prevX != null && prevY != null) {
        var dx = e.clientX - prevX;
        var dy = e.clientY - prevY;

        var ratio = inputs.scaleDevicePixel.checked ? 1 : devicePixelRatio;
        var scale = canvasScale / ratio;

        if (e.shiftKey) {
            // = 1 pixel
            dx = scale * Math.sign(dx);
            dy = scale * Math.sign(dy);
        }
        
        if (isInSelection) {
            dx = Math.round(dx / scale);
            dy = Math.round(dy / scale);

            var px = cropX, py = cropY;
            var xSign = (resizeFromLeft ? -1 : 1);
            var ySign = (resizeFromTop ? -1 : 1);
            if (isResizing) {
                var width = cropWidth, height = cropHeight;
                if (cropShape == cropShapes.FREEFORM) {
                    width += dx * xSign;
                    height += dy * ySign;
                    if (resizeFromLeft) {
                        px += dx;
                        if (px < 0) {
                            width += px;
                            px = 0;
                        }
                    }
                    if (resizeFromTop) {
                        py += dy;
                        if (py < 0) {
                            height += py;
                            py = 0;
                        }
                    }
                }
                else {
                    var delta = (Math.abs(dx) > Math.abs(dy)) ? dx * xSign : dy * ySign;
                    var hDelta = delta * xSign,
                        vDelta = delta * ySign;
                    let left = px + hDelta,
                        top = py + vDelta,
                        right = left + width + delta,
                        bottom = top + height + delta;
                    
                    var d = 0;

                    if (!inputs.allowOffscreen.checked) {
                        if (resizeFromLeft && left < 0) d = -left;
                        if (resizeFromTop && top < 0) d = -top;

                        if (right > img.width) d = right - img.width - hDelta;
                        if (bottom > img.height) d = bottom - img.height - vDelta;
                    }

                    if (d) delta = (d > delta ? 0 : delta - d);

                    width = height += delta;
                    if (resizeFromLeft) px += delta * xSign;
                    if (resizeFromTop) py += delta * ySign;
                }

                if (resizeFromLeft && width < 10)
                    px -= 10 - width;
                
                if (resizeFromTop && height < 10)
                    py -= 10 - height;

                // Set the crop positions first so setCropSize could clamp the values correctly
                cropX = px; cropY = py;
                setCropSize(width, height);
                setCropPosition(px, py);
            }
            else {
                px += dx;
                py += dy;
                setCropPosition(px, py);
            }
            
            redrawCanvas();
        }
        else {
            setCanvasMargins(canvasX + dx, canvasY + dy);
        }
    }
    prevX = e.clientX;
    prevY = e.clientY;
}

function mouseUpListener(e) {
    if (isHidden() || e.button != 0) return;
    checkMousePos(e);
    mouseDown = false;
    prevX = prevY = null;
    isInSelection = false;
}

function wheelListener(e) {
    if (isHidden()) return;
    var incr = 0.1;
    if (e.deltaY > 0)
        incr = -incr;

    setCanvasScale(canvasScale + incr);
}

function getTouchDist(touch1, touch2) {
    return Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
}

var touchPinching = false;
function touchStartListener(e) {
    touchToMouseEvent.call(this, e);
    if (e.touches.length >= 2) {
        touchPinching = true;
        prevTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        isInSelection = false;
    }
}

var prevTouchDist;
function touchMoveListener(e) {
    if (touchPinching) {
        var dist = getTouchDist(e.touches[0], e.touches[1]);
        var diff = dist - prevTouchDist;
        setCanvasScale(canvasScale + diff/200);
        prevTouchDist = dist;
    }
}

function touchEndListener(e) {
    if (touchPinching && e.touches.length < 2)
        touchPinching = false;
}

function keyDownListener(e) {
    var code;
    if (e.code) code = e.code;
    else {
        switch (e.keyCode) {
            case 38: code = "ArrowUp";    break;
            case 40: code = "ArrowDown";  break;
            case 37: code = "ArrowLeft";  break;
            case 39: code = "ArrowRight"; break;
            default: return;
        }
    }
    switch (code) {
        case "ArrowUp": 
            e.shiftKey ? setCropSize(cropWidth, cropHeight - 1) : setCropPosition(cropX, cropY - 1);
            break;

        case "ArrowDown":
            e.shiftKey ? setCropSize(cropWidth, cropHeight + 1, true) : setCropPosition(cropX, cropY + 1);
            break;

        case "ArrowLeft":
            e.shiftKey ? setCropSize(cropWidth - 1, cropHeight) : setCropPosition(cropX - 1, cropY);
            break;

        case "ArrowRight":
            e.shiftKey ? setCropSize(cropWidth + 1, cropHeight, true) : setCropPosition(cropX + 1, cropY);
            break;

        default: return;
    }
    redrawCanvas();
}

function isPointInRect(x, y, rect) {
    return (x >= rect.x && y >= rect.y &&
            x <= rect.x + rect.width && y <= rect.y + rect.height);
}

function isPointInCircle(x, y, cx, cy, radius) {
    return Math.pow(x - cx, 2) + Math.pow(y - cy, 2) < Math.pow(radius, 2);
}

var editor = {
    init, open, show, hide
}
export default editor;