/**
 * @fileoverview entity object is class for entry object canvas view.
 */

'use strict';

import PIXIHelper from './pixi/helper/PIXIHelper';
import { PIXIDragHelper } from './pixi/helper/PIXIDragHelper';
import { PIXIAtlasManager } from './pixi/atlas/PIXIAtlasManager';

/**
 * Construct entity class
 * @param {!Entry.EntryObject} object
 * @constructor
 */
Entry.EntityObject = function(object) {
    window.bot = this;
    console.log("[TEST] window.bot 에 할당 됨.");
    /** @type {!string} */
    this.parent = object;
    this.type = object.objectType;
    /** @type {Array<xml script>} */
    this.flip = false;
    this.collision = Entry.Utils.COLLISION.NONE;
    this.id = Entry.generateHash();
    this.removed = false;
    this.stamps = [];
    this.shapes = [];

    if (this.type == 'sprite') {
        this.object = new PIXI.Sprite();
        this.object.pixelPerfect = true;
        this.setInitialEffectValue();
    } else if (this.type == 'textBox') {
        this.object = new PIXI.Container();
        // this.textObject = new createjs.Text();
        // this.textObject.font = '20px Nanum Gothic';
        // this.textObject.textBaseline = 'middle';
        // this.textObject.textAlign = 'center';

        // this.textObject = PIXIHelper.text("", '20px Nanum Gothic', "#000000", 'middle', 'center');
        this.textObject = PIXIHelper.text("", '20px Nanum Gothic', "#000000", 'alphabetic', 'center');
        this.textObject.anchor.set(0.5, 0.5);


        this.bgObject = Entry.stage.baseAsset.newSprite("common_blank");
        this.bgObject.anchor.set(0.5, 0.5);

        this.object.addChild(this.bgObject);
        this.object.addChild(this.textObject);

        this.fontType = 'Nanum Gothic';
        this.fontSize = 20;
        this.fontBold = false;
        this.fontItalic = false;
        this.underLine = false;
        this.strike = false;
    }
    
    this.object.interactive = true;
    this.object.entity = this;
    this.object.cursor = 'pointer';

    this.object.on("pointerdown", function(evt) {
        var id = this.entity.parent.id;
        Entry.dispatchEvent('entityClick', this.entity);
        Entry.stage.isObjectClick = true;

        if (Entry.type != 'minimize' && Entry.stage.isEntitySelectable()) {
            PIXIDragHelper.handleDrag(this);
            var gp = evt.data.global;
            this.offset = {
                x: -this.parent.x + this.entity.getX() - (gp.x * 0.75 - 240),
                y: -this.parent.y - this.entity.getY() - (gp.y * 0.75 - 135),
            };
            this.cursor = 'move';
            this.entity.initCommand();
            Entry.container.selectObject(id);
        }
    });

    var _onPointerUp = function(evt) {
        Entry.dispatchEvent('entityClickCanceled', this.entity);
        this.cursor = 'pointer';
        this.entity.checkCommand();
    };
    this.object.on("pointerup", _onPointerUp);
    this.object.on("pointerupoutside", _onPointerUp);

    if (Entry.type !== 'minimize') {
        this.object.on(PIXIDragHelper.MOVE, function(evt) {
            if (Entry.stage.isEntitySelectable()) {
                var entity = this.entity;
                if (entity.parent.getLock()) return;
                var gp = evt.data.global;
                this.cursor = 'move';
                entity.setX(gp.x * 0.75 - 240 + this.offset.x);
                entity.setY(-(gp.y * 0.75 - 135) - this.offset.y);
                Entry.stage.updateObject();
            }
        });
    }
};

/**
 * Construct entity class
 * @param {?picture model} pictureModel
 * @param {?entity model} entityModel
 * @constructor
 */
Entry.EntityObject.prototype.injectModel = function(pictureModel, entityModel) {
    var type = this.type;
    if (type == 'sprite') {
        this.setImage(pictureModel);
    } else if (type == 'textBox') {
        var parent = this.parent;
        entityModel.text = entityModel.text || parent.text || parent.name;
        this.setFont(entityModel.font);
        this.setBGColour(entityModel.bgColor);
        this.setColour(entityModel.colour);
        this.setUnderLine(entityModel.underLine);
        this.setStrike(entityModel.strike);
        this.setText(entityModel.text);
    }

    //entity
    if (entityModel) {
        this.syncModel_(entityModel);
    }
};

/**
 * sync this model with parameter
 * @param {!entity model} entityModel
 * @private
 */
Entry.EntityObject.prototype.syncModel_ = function({
    x,
    y,
    regX,
    regY,
    scaleX,
    scaleY,
    rotation,
    direction,
    lineBreak,
    width,
    height,
    text,
    textAlign,
    fontSize,
    visible,
}) {
    this.setX(x);
    this.setY(y);
    this.setRegX(regX);
    this.setRegY(regY);
    this.setScaleX(scaleX);
    this.setScaleY(scaleY);
    this.setRotation(rotation);
    this.setDirection(direction, true);
    this.setLineBreak(lineBreak);
    this.setWidth(width);
    this.setHeight(height);
    this.setText(text);
    this.setTextAlign(textAlign);
    this.setFontSize(fontSize || this.getFontSize());
    this.setVisible(visible);
};

Entry.EntityObject.prototype.initCommand = function() {
    if (!Entry.engine.isState('stop')) {
        return;
    }

    this._entityModelBefore = this.toJSON();
};

Entry.EntityObject.prototype.checkCommand = function() {
    if (!Entry.engine.isState('stop')) {
        return;
    }

    var oldModel = this._entityModelBefore;
    delete this._entityModelBefore;
    var json = this.toJSON();

    if (_.isEqual(json, oldModel)) {
        return;
    }

    Entry.do('entitySetModel', this.parent.id, json, oldModel);
};

/**
 * for redo and undo
 * @param {!entity model} entityModel
 * @return {Entry.State} capture current state
 */
Entry.EntityObject.prototype.setModel = function(entityModel) {
    this.syncModel_(entityModel);
    Entry.dispatchEvent('updateObject');
    Entry.stage.updateObject();
};

/**
 * X coordinate setter
 * @param {number} x
 */
Entry.EntityObject.prototype.setX = function(x) {
    if (typeof x != 'number') return;

    /** @type {number} */
    this.x = x;
    this.object.x = this.x;
    !this.isClone && this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * X coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getX = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.x, toFixedValue);
    else return this.x;
};

/**
 * Y coordinate setter
 * @param {number} y
 */
Entry.EntityObject.prototype.setY = function(y) {
    if (typeof y != 'number') return;

    /** @type {number} */
    this.y = y;
    this.object.y = -this.y;
    !this.isClone && this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * Y coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getY = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.y, toFixedValue);
    else return this.y;
};

/**
 * direction getter
 * @return {number}
 */
Entry.EntityObject.prototype.getDirection = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.direction, toFixedValue);
    else return this.direction;
};

/**
 * direction setter
 * @param {number} direction
 * @param {boolean} flippable
 */
Entry.EntityObject.prototype.setDirection = function(direction = 0, flippable) {
    direction = direction % 360;
    var parent = this.parent;

    if (parent.getRotateMethod() == 'vertical' && !flippable) {
        var previousIsRight = this.direction >= 0 && this.direction < 180;
        var afterIsRight = direction >= 0 && direction < 180;
        if (previousIsRight != afterIsRight) {
            this.setScaleX(-this.getScaleX());
            Entry.stage.updateObject();
            this.flip = !this.flip;
        }
    }
    /** @type {number} */
    this.direction = direction.mod(360);
    this.object.direction = this.direction;
    !this.isClone && parent.updateRotationView();
    Entry.dispatchEvent('updateObject');
    Entry.requestUpdate = true;
};

/**
 * rotation setter
 * @param {number} rotation
 * */
Entry.EntityObject.prototype.setRotation = function(rotation) {
    /** @type {number} */
    if (this.parent.getRotateMethod() !== 'free') rotation = 0;

    this.rotation = rotation.mod(360);
    this.object.rotation = this.rotation * Math.PI / 180;
    this.updateDialog();
    !this.isClone && this.parent.updateRotationView();
    Entry.dispatchEvent('updateObject');
    Entry.requestUpdate = true;
};

/**
 * rotation getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRotation = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.rotation, toFixedValue);
    else return this.rotation;
};

/**
 * regX coordinate setter
 * @param {number} regX
 */
Entry.EntityObject.prototype.setRegX = function(regX) {
    if (this.type == 'textBox') regX = 0;
    /** @type {number} */
    this.regX = regX;
    this.object.pivot.x = this.regX;
    Entry.requestUpdate = true;
};

/**
 * regX coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRegX = function() {
    return this.regX;
};

/**
 * regY coordinate setter
 * @param {number} regY
 */
Entry.EntityObject.prototype.setRegY = function(regY) {
    if (this.type == 'textBox') regY = 0;
    /** @type {number} */
    this.regY = regY;
    this.object.pivot.y = this.regY;
    Entry.requestUpdate = true;
};

/**
 * regY coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRegY = function() {
    return this.regY;
};

/**
 * scaleX coordinate setter
 * @param {number} scaleX
 */
Entry.EntityObject.prototype.setScaleX = function(scaleX) {
    /** @type {number} */
    // console.log(`setScaleX(${scaleX})`);
    this.scaleX = scaleX;
    this.object.scale.x = this.scaleX;
    if(this.textObject) {
        this.textObject.setFontScaleX(scaleX);
    }
    this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * scaleX coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getScaleX = function() {
    return this.scaleX;
};

/**
 * scaleY coordinate setter
 * @param {number} scaleY
 */
Entry.EntityObject.prototype.setScaleY = function(scaleY) {
    /** @type {number} */
    // console.log(`setScaleY(${scaleY})`);
    this.scaleY = scaleY;
    this.object.scale.y = this.scaleY;
    if(this.textObject) {
        this.textObject.setFontScaleY(scaleY);
    }
    this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * scaleY coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getScaleY = function() {
    return this.scaleY;
};

/**
 * object size setter
 * @param {number} size
 */
Entry.EntityObject.prototype.setSize = function(size) {
    var scale = Math.max(1, size) / this.getSize();
    this.setScaleX(this.getScaleX() * scale);
    this.setScaleY(this.getScaleY() * scale);
    !this.isClone && this.parent.updateCoordinateView();
    Entry.requestUpdate = true;
};

/**
 * get object size
 * @return {number}
 */
Entry.EntityObject.prototype.getSize = function(toFixedValue) {
    var value =
        (this.getWidth() * Math.abs(this.getScaleX()) +
            this.getHeight() * Math.abs(this.getScaleY())) /
        2;
    if (toFixedValue) return Entry.Utils.toFixed(value, toFixedValue);
    return value;
};

/**
 * width coordinate setter
 * @param {number} width
 */
Entry.EntityObject.prototype.setWidth = function(width) {
    // console.log(`setWidth(${width})`);
    /** @type {number} */
    this.width = width;
    PIXIHelper.todo("원래는 width 였는데 $width 우선 바궈놓음");
    this.object.$width = this.width;
    if (this.textObject && this.getLineBreak())
        this.textObject.style.wordWrapWidth = this.width;
    this.updateDialog();
    this.updateBG();
    Entry.requestUpdate = true;
};

/**
 * width coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getWidth = function() {
    return this.width;
};

/**
 * height coordinate setter
 * @param {number} height
 */
Entry.EntityObject.prototype.setHeight = function(height) {
    /** @type {number} */
    // console.log(`setHeight(${height})`);
    this.height = height;
    if (this.textObject) {
        PIXIHelper.todo("원래는 height 였는데 $height 우선 바궈놓음");
        this.object.$height = this.height;
        this.alignTextBox();
    }
    this.updateDialog();
    this.updateBG();
    Entry.requestUpdate = true;
};

/**
 * height coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getHeight = function() {
    return this.height;
};

/**
 * colour setter
 * @param {?string} colour
 */
Entry.EntityObject.prototype.setColour = function(colour = '#000000') {
    /** @type {string} */
    this.colour = colour;
    if (this.textObject) {
        this.textObject.style.fill = this.colour;
    }
    Entry.requestUpdate = true;
};

/**
 * colour getter
 * @return {colour}
 */
Entry.EntityObject.prototype.getColour = function() {
    return this.colour;
};

/**
 * BG colour setter, for textBox object
 * @param {?string} colour
 */
Entry.EntityObject.prototype.setBGColour = function(colour = 'transparent') {
    /** @type {string} */
    this.bgColor = colour;
    this.updateBG();
    //this.object.color = this.colour;
    Entry.requestUpdate = true;
};

/**
 * BG colour getter, for textBox object
 * @return {colour}
 */
Entry.EntityObject.prototype.getBGColour = function() {
    return this.bgColor;
};

Entry.EntityObject.prototype.setUnderLine = function(underLine = false) {
    this.underLine = underLine;
    this.textObject.style.underLine = underLine;
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.getUnderLine = function() {
    return this.underLine;
};

Entry.EntityObject.prototype.setStrike = function(strike = false) {
    this.strike = strike;
    this.textObject.style.cancelLine = strike;
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.getStrike = function() {
    return this.strike;
};

/**
 * font getter
 */
Entry.EntityObject.prototype.getFont = function() {
    var fontArray = [];
    if (this.fontBold) fontArray.push('bold');
    if (this.fontItalic) fontArray.push('italic');
    fontArray.push(this.getFontSize() + 'px');
    fontArray.push(this.fontType);
    return fontArray.join(' ');
};

/**
 * font setter
 */
Entry.EntityObject.prototype.setFont = function(font = '20px Nanum Gothic') {
    if (this.parent.objectType != 'textBox') return;
    if (this.textObject.font === font) return;

    var fontArray = font.split(' ');
    var i = 0;

    if ((i = fontArray.indexOf('bold') > -1)) {
        fontArray.splice(i - 1, 1);
        this.setFontBold(true);
    }
    if ((i = fontArray.indexOf('italic') > -1)) {
        fontArray.splice(i - 1, 1);
        this.setFontItalic(true);
    }
    this.setFontSize(parseInt(fontArray.shift()));
    this.setFontType(fontArray.join(' '));

    this.textObject.font = this.getFont();
    Entry.stage.update();
    // this.setWidth(this.textObject.getMeasuredWidth());
    this.setWidth(PIXIHelper.textWidth(this.textObject));
    this.updateBG();
    Entry.stage.updateObject();
};

Entry.EntityObject.prototype.setLineHeight = function() {
    switch (this.getFontType()) {
        case 'Nanum Gothic Coding': {
            this.textObject.lineHeight = this.fontSize;
            break;
        }
        default: {
            this.textObject.lineHeight = 0;
            break;
        }
    }
};

Entry.EntityObject.prototype.syncFont = function() {
    var textObject = this.textObject;
    // textObject.font = this.getFont();
    // console.log("syncFont");
    var style = textObject.style;
    style.fontSize = this.getFontSize() + 'px';
    style.fontStyle = this.fontItalic ? "italic" : "normal";
    style.fontWeight = this.fontBold ? "bold" : "normal";
    style.fontFamily = this.fontType;

    this.setLineHeight();
    Entry.stage.update();
    if (this.getLineBreak()) {
        if (this.fontType == 'Nanum Gothic Coding') {
            textObject.y =
                // textObject.getMeasuredLineHeight() / 2 -
                PIXIHelper.getMeasuredLineHeight(textObject) / 2 -
                this.getHeight() / 2 +
                10;
        }
    } else {
        this.setWidth(PIXIHelper.textWidth(textObject));
        this.setHeight(PIXIHelper.textHeight(textObject));
        // this.setWidth(textObject.getMeasuredWidth());
        // this.setHeight(textObject.getMeasuredHeight());
    }
    Entry.stage.updateObject();
    Entry.requestUpdate = true;
};

/**
 * font type getter
 */
Entry.EntityObject.prototype.getFontType = function() {
    return this.fontType;
};

/**
 * font type setter
 */
Entry.EntityObject.prototype.setFontType = function(fontType = 'Nanum Gothic') {
    if (this.parent.objectType != 'textBox') return;
    this.fontType = fontType;
    this.syncFont();
};

/**
 * font size getter
 */
Entry.EntityObject.prototype.getFontSize = function(fontSize) {
    return this.fontSize;
};

/**
 * font size setter
 */
Entry.EntityObject.prototype.setFontSize = function(fontSize = 20) {
    if (this.parent.objectType != 'textBox') return;
    if (this.fontSize == fontSize) return;
    this.fontSize = fontSize;
    this.syncFont();
    this.alignTextBox();
};

/**
 * set font bold state
 */
Entry.EntityObject.prototype.setFontBold = function(isFontBold) {
    this.fontBold = isFontBold;
    Entry.requestUpdate = true;
};

/**
 * toggle bold on,off and return current
 */
Entry.EntityObject.prototype.toggleFontBold = function() {
    this.fontBold = !this.fontBold;
    this.syncFont();
    return this.fontBold;
};

/**
 * set font italic state
 */
Entry.EntityObject.prototype.setFontItalic = function(isFontItalic) {
    this.fontItalic = isFontItalic;
    Entry.requestUpdate = true;
};

/**
 * toggle italic on,off and return current
 */
Entry.EntityObject.prototype.toggleFontItalic = function() {
    this.fontItalic = !this.fontItalic;
    this.syncFont();
    return this.fontItalic;
};

Entry.EntityObject.prototype.getFontName = function() {
    if (this.type != 'textBox') return;
    var font = this.textObject.font;
    if (!font) return '';

    return font
        .split(' ')
        .filter((font) => !/^(bold|italic)$/.test(font) && !~font.indexOf('px'))
        .join(' ')
        .trim();
};

/**
 * text setter
 * @param {string} text
 */
Entry.EntityObject.prototype.setText = function(text = '') {
    if (this.parent.objectType != 'textBox') return;
    /** @type {string} */
    this.text = text;
    this.textObject.text = this.text;
    if (!this.lineBreak) {
        // this.setWidth(this.textObject.getMeasuredWidth());
        this.setWidth(PIXIHelper.textWidth(this.textObject));
        this.parent.updateCoordinateView();
    } else {
        //TODO (박봉배 2018.09.11)alignTextBox 대신에 y 중앙 정렬 코드만 넣는것이 좋아보임.
        this.alignTextBox();
    }
    this.updateBG();
    Entry.stage.updateObject();
};

/**
 * text getter
 * @return {string}
 */
Entry.EntityObject.prototype.getText = function() {
    return this.text;
};

/**
 * textAlign setter
 * @param {number} textAlign
 */
Entry.EntityObject.prototype.setTextAlign = function(textAlign) {
    if (this.parent.objectType != 'textBox') return;
    if (textAlign === undefined) textAlign = Entry.TEXT_ALIGN_CENTER;
    this.textAlign = textAlign;

    var anchorX = 0;
    var alingValue = "center";
    switch(textAlign) {
        case Entry.TEXT_ALIGN_LEFT:
            alingValue = "left";
            anchorX = 0;
            break;
        case Entry.TEXT_ALIGN_CENTER:
            alingValue = "center";
            anchorX = 0.5;
            break;
        case Entry.TEXT_ALIGN_RIGHT:
            alingValue = "right";
            anchorX = 1;
            break;
    }
    this.textObject.anchor.x = anchorX;
    this.textObject.style.align = alingValue;
    this.alignTextBox();
    this.updateBG();
    Entry.stage.updateObject();
    /*
    this.setWidth(this.textObject.getMeasuredWidth());
    this.updateBG();
    */
};

/**
 * textAlign getter
 * @return {number}
 */
Entry.EntityObject.prototype.getTextAlign = function() {
    return this.textAlign;
};

/**
 * lineBreak setter
 * @param {boolean} lineBreak
 */
Entry.EntityObject.prototype.setLineBreak = function(lineBreak = false) {
    if (this.parent.objectType != 'textBox') return;
    // console.log("setLineBreak'");
    var previousState = this.lineBreak;
    this.lineBreak = lineBreak;

    if (previousState && !this.lineBreak) {
        // this.textObject.lineWidth = null;
        this.textObject.style.wordWrap = false;
        this.setHeight(PIXIHelper.getMeasuredLineHeight(this.textObject));
        this.setText(this.getText().replace(/\n/g, ''));
    } else if (!previousState && this.lineBreak) {
        this.setFontSize(this.getFontSize() * this.getScaleX());
        this.setHeight(PIXIHelper.getMeasuredLineHeight(this.textObject) * 3);
        this.setWidth(this.getWidth() * this.getScaleX());
        this.setScaleX(1);
        this.setScaleY(1);
        this.textObject.style.wordWrap = true;
        this.textObject.style.breakWords = true;
        this.textObject.style.wordWrapWidth = this.getWidth();
        // this.textObject.lineWidth = this.getWidth();
        this.alignTextBox();
        if (this.fontType == 'Nanum Gothic Coding') {
            var textObjectHeight = PIXIHelper.getMeasuredLineHeight(this.textObject);
            this.textObject.y =
                textObjectHeight / 2 - this.getHeight() / 2 + 10;
        }
    }

    Entry.stage.updateObject();
};

// Entry.EntityObject.prototype.setLineBreak = function(lineBreak = false) {
//     if (this.parent.objectType != 'textBox') return;
//
//     var previousState = this.lineBreak;
//     this.lineBreak = lineBreak;
//
//     if (previousState && !this.lineBreak) {
//         this.textObject.lineWidth = null;
//         this.setHeight(this.textObject.getMeasuredLineHeight());
//         this.setText(this.getText().replace(/\n/g, ''));
//     } else if (!previousState && this.lineBreak) {
//         this.setFontSize(this.getFontSize() * this.getScaleX());
//         this.setHeight(this.textObject.getMeasuredLineHeight() * 3);
//         this.setWidth(this.getWidth() * this.getScaleX());
//         this.setScaleX(1);
//         this.setScaleY(1);
//         this.textObject.lineWidth = this.getWidth();
//         this.alignTextBox();
//         if (this.fontType == 'Nanum Gothic Coding') {
//             var textObjectHeight = this.textObject.getMeasuredLineHeight();
//             this.textObject.y =
//                 textObjectHeight / 2 - this.getHeight() / 2 + 10;
//         }
//     }
//
//     Entry.stage.updateObject();
// };


/**
 * lineBreak getter
 * @return {number}
 */
Entry.EntityObject.prototype.getLineBreak = function() {
    return this.lineBreak;
};

/**
 * visible setter
 * @param {boolean} visible
 */
Entry.EntityObject.prototype.setVisible = function(visible = true) {
    /** @type {string} */
    this.visible = visible;
    this.object.visible = this.visible;
    if (this.dialog) this.syncDialogVisible();
    Entry.requestUpdate = true;
    return this.visible;
};

/**
 * visible getter
 * @return {boolean}
 */
Entry.EntityObject.prototype.getVisible = function() {
    return this.visible;
};

/**
 * Change picture
 * @param {?picture model} pictureModel
 */
// Entry.EntityObject.prototype.setImage = function(pictureModel) {
//     console.log(pictureModel);
//     var that = this;
//     delete pictureModel._id;
//
//     Entry.assert(this.type == 'sprite', 'Set image is only for sprite object');
//     if (!pictureModel.id) pictureModel.id = Entry.generateHash();
//
//     this.picture = pictureModel;
//     var dimension = this.picture.dimension;
//     var entityWidth = this.getWidth();
//     var entityHeight = this.getHeight();
//
//     var absoluteRegX = this.getRegX() - entityWidth / 2;
//     var absoluteRegY = this.getRegY() - entityHeight / 2;
//     this.setWidth(dimension.width);
//     this.setHeight(dimension.height);
//     if (!dimension.scaleX) {
//         dimension.scaleX = this.getScaleX();
//         dimension.scaleY = this.getScaleY();
//     }
//
//     this.setScaleX(this.scaleX);
//     this.setScaleY(this.scaleY);
//     this.setRegX(this.width / 2 + absoluteRegX);
//     this.setRegY(this.height / 2 + absoluteRegY);
//
//     //pictureId can be duplicated by copy/paste
//     //add entityId in order to differentiate copied pictures
//     var cacheId = !this.isClone ? pictureModel.id + this.id : pictureModel.id;
//
//     var image = Entry.container.getCachedPicture(cacheId);
//
//     if (!image) {
//         image = new Image();
//
//         image.onload = function(e) {
//             if (!that.removed) Entry.container.cachePicture(cacheId, this);
//
//             this.onload = null;
//             setImage(this);
//         };
//
//         var fileUrl = pictureModel.fileurl;
//         if (fileUrl) image.src = fileUrl;
//         else {
//             var fileName = pictureModel.filename;
//             image.src =
//                 Entry.defaultPath +
//                 '/uploads/' +
//                 fileName.substring(0, 2) +
//                 '/' +
//                 fileName.substring(2, 4) +
//                 '/image/' +
//                 fileName +
//                 '.png';
//         }
//
//         // that.object.image = image;
//         PIXIHelper.setTextureToPIXISprite(that.object, image);
//         // if (!_.isEmpty(that.object.filters)) that.cache();
//         // else that.object.uncache();
//         PIXIHelper.cacheIfHasFilters(that);
//
//     } else setImage(image);
//
//     function setImage(datum) {
//         // that.object.image = datum;
//         PIXIHelper.setTextureToPIXISprite(that.object, image);
//
//         // if (!_.isEmpty(that.object.filters)) that.cache();
//         // else that.object.uncache();
//         PIXIHelper.cacheIfHasFilters(that);
//
//         Entry.requestUpdate = true;
//     }
//
//     Entry.dispatchEvent('updateObject');
// };


Entry.EntityObject.prototype.setImage = function(pictureModel) {
    var that = this;
    delete pictureModel._id;

    Entry.assert(this.type == 'sprite', 'Set image is only for sprite object');
    if (!pictureModel.id) pictureModel.id = Entry.generateHash();

    this.picture = pictureModel;
    var dimension = this.picture.dimension;
    var entityWidth = this.getWidth();
    var entityHeight = this.getHeight();

    var absoluteRegX = this.getRegX() - entityWidth / 2;
    var absoluteRegY = this.getRegY() - entityHeight / 2;
    this.setWidth(dimension.width);
    this.setHeight(dimension.height);
    if (!dimension.scaleX) {
        dimension.scaleX = this.getScaleX();
        dimension.scaleY = this.getScaleY();
    }

    this.setScaleX(this.scaleX);
    this.setScaleY(this.scaleY);
    this.setRegX(this.width / 2 + absoluteRegX);
    this.setRegY(this.height / 2 + absoluteRegY);

    //pictureId can be duplicated by copy/paste
    //add entityId in order to differentiate copied pictures
    var cacheId = !this.isClone ? pictureModel.id + this.id : pictureModel.id;

    this.object.texture = PIXIAtlasManager.getTexture(
        this.parent.scene.id,
        pictureModel.fileurl || pictureModel.filename
    );

    Entry.requestUpdate = true;

    /*
    var image = Entry.container.getCachedPicture(cacheId);

    if (!image) {
        image = new Image();

        image.onload = function(e) {
            if (!that.removed) Entry.container.cachePicture(cacheId, this);
            PIXIAtlasManager.putImage(pictureModel.id, image);
            this.onload = null;
            setImage(this);
        };

        image.src = this._getImagePath(pictureModel);

        // that.object.image = image;
        // PIXIHelper.setTextureToPIXISprite(that.object, image);
        // if (!_.isEmpty(that.object.filters)) that.cache();
        // else that.object.uncache();
        // PIXIHelper.cacheIfHasFilters(that);

    } else {
        setImage(image);
    }

    function setImage(datum) {
        // that.object.image = datum;
        //PIXIHelper.setTextureToPIXISprite(that.object, image);

        // if (!_.isEmpty(that.object.filters)) that.cache();
        // else that.object.uncache();
        PIXIHelper.cacheIfHasFilters(that);

        Entry.requestUpdate = true;
    }
    */
    Entry.dispatchEvent('updateObject');
};


Entry.EntityObject.prototype._getImagePath = function(pictureModel) {
    var path = pictureModel.fileurl;
    if (path) return path;

    path = pictureModel.filename;
    return Entry.defaultPath + '/uploads/' + path.substring(0, 2) + '/' + path.substring(2, 4) + '/image/' + path + '.png';
};

/**
 * Apply PIXI filter
 */
Entry.EntityObject.prototype.applyFilter = function(isForce, forceEffects) {
    var effects = this.effect;
    var object = this.object;

    var diffEffects = isEqualEffects(effects, this.getInitialEffectValue());
    if (!isForce && diffEffects.length === 0) return;

    if (Array.isArray(forceEffects)) {
        diffEffects = diffEffects.concat(forceEffects);
    }

    (function(e, obj) {
        var f = [];
        var adjust = Entry.adjustValueWithMaxMin;
        if (~diffEffects.indexOf('brightness')) {
            // pixi 필터에 brightness 가 있지만, createjs 와 matrix 값이 달라 결과가 다르게 보임. 그래서 동일하게 구현함.
            var brigthness = adjust(e.brightness, -100, 100);
            brigthness /= 255;
            const matrix = [
                1, 0, 0, 0, brigthness,
                0, 1, 0, 0, brigthness,
                0, 0, 1, 0, brigthness,
                0, 0, 0, 1, 0,
            ];
            var cmBrightness = new PIXI.filters.ColorMatrixFilter();
            cmBrightness.matrix = matrix;
            f.push(cmBrightness);
        }

        if (~diffEffects.indexOf('hue')) {
            e.hue = e.hue.mod(360);
            var cmHue = new PIXI.filters.ColorMatrixFilter();
            cmHue.hue(e.hue);
            f.push(cmHue);
        }

        if (~diffEffects.indexOf('hsv')) {
            var matrixValue = [
                1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0,
            ];

            var degrees = e.hsv * 3.6;
            var r = degrees * 3 * Math.PI / 180;
            var cosVal = Math.cos(r);
            var sinVal = Math.sin(r);

            var v = Math.abs(e.hsv / 100);
            if (v > 1) {
                v = v - Math.floor(v);
            }

            if (v > 0 && v <= 0.33) {
                var matrixValue = [
                    1, 0, 0, 0, 0,
                    0, cosVal, sinVal, 0, 0,
                    0, -1 * sinVal, cosVal, 0, 0,
                    0, 0, 0, 1, 0,
                ];
            } else if (v <= 0.66) {
                var matrixValue = [
                    cosVal, 0, sinVal, 0, 0,
                    0, 1, 0, 0, 0,
                    sinVal, 0, cosVal, 0, 0,
                    0, 0, 0, 1, 0,
                ];
            } else if (v <= 0.99) {
                var matrixValue = [
                    cosVal, sinVal, 0, 0, 0,
                    -1 * sinVal, cosVal, 0, 0, 0,
                    0, 0, 1, 0, 0,
                    0, 0, 0, 1, 0,
                ];
            }

            var colorFilter = new PIXI.filters.ColorMatrixFilter();
            colorFilter.matrix = matrixValue;
            f.push(colorFilter);

            // var rgb = PIXIHelper.HSVtoRGB(degrees/360, v, 1);
            // var color = (rgb.r << 16) + (rgb.g << 8) + rgb.b;
            // console.log(rgb, color);
            // obj.tint = color;

        }

        if (~diffEffects.indexOf('alpha')) {
            obj.alpha = e.alpha = adjust(e.alpha, 0, 1);
        }

        obj.filters = f;
    })(effects, object);

    this.cache();

    function isEqualEffects(effectsA, effectsB) {
        var diffEffects = [];
        for (var key in effectsA) {
            if (effectsA[key] !== effectsB[key]) {
                diffEffects.push(key);
            }
        }
        return diffEffects;
    }
};




// /**
//  * Apply easel filter
//  */
// Entry.EntityObject.prototype.applyFilter = function(isForce, forceEffects) {
//     var effects = this.effect;
//     var object = this.object;
//
//     var diffEffects = isEqualEffects(effects, this.getInitialEffectValue());
//     if (!isForce && diffEffects.length === 0) return;
//
//     if (Array.isArray(forceEffects)) {
//         diffEffects = diffEffects.concat(forceEffects);
//     }
//
//     (function(e, obj) {
//         var f = [];
//         var adjust = Entry.adjustValueWithMaxMin;
//         console.log("diffEffects", diffEffects);
//         if (~diffEffects.indexOf('brightness')) {
//             e.brightness = e.brightness;
//             var cmBrightness = new createjs.ColorMatrix();
//             cmBrightness.adjustColor(adjust(e.brightness, -100, 100), 0, 0, 0);
//             var brightnessFilter = new createjs.ColorMatrixFilter(cmBrightness);
//             f.push(brightnessFilter);
//         }
//
//         if (~diffEffects.indexOf('hue')) {
//             e.hue = e.hue.mod(360);
//             var cmHue = new createjs.ColorMatrix();
//             cmHue.adjustColor(0, 0, 0, e.hue);
//             var hueFilter = new createjs.ColorMatrixFilter(cmHue);
//             f.push(hueFilter);
//         }
//
//         if (~diffEffects.indexOf('hsv')) {
//             var matrixValue = [
//                 1,
//                 0,
//                 0,
//                 0,
//                 0,
//                 0,
//                 1,
//                 0,
//                 0,
//                 0,
//                 0,
//                 0,
//                 1,
//                 0,
//                 0,
//                 0,
//                 0,
//                 0,
//                 1,
//                 0,
//                 0,
//                 0,
//                 0,
//                 0,
//                 1,
//             ];
//
//             var degrees = e.hsv * 3.6;
//             var r = degrees * 3 * Math.PI / 180;
//             var cosVal = Math.cos(r);
//             var sinVal = Math.sin(r);
//
//             var v = Math.abs(e.hsv / 100);
//             if (v > 1) {
//                 v = v - Math.floor(v);
//             }
//
//             if (v > 0 && v <= 0.33) {
//                 var matrixValue = [
//                     1,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     cosVal,
//                     sinVal,
//                     0,
//                     0,
//                     0,
//                     -1 * sinVal,
//                     cosVal,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                 ];
//             } else if (v <= 0.66) {
//                 var matrixValue = [
//                     cosVal,
//                     0,
//                     sinVal,
//                     0,
//                     0,
//                     0,
//                     1,
//                     0,
//                     0,
//                     0,
//                     sinVal,
//                     0,
//                     cosVal,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                 ];
//             } else if (v <= 0.99) {
//                 var matrixValue = [
//                     cosVal,
//                     sinVal,
//                     0,
//                     0,
//                     0,
//                     -1 * sinVal,
//                     cosVal,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                     0,
//                     0,
//                     0,
//                     0,
//                     0,
//                     1,
//                 ];
//             }
//
//             var calcMatrix = new createjs.ColorMatrix().concat(matrixValue);
//             var colorFilter = new createjs.ColorMatrixFilter(calcMatrix);
//             f.push(colorFilter);
//         }
//
//         if (~diffEffects.indexOf('alpha')) {
//             obj.alpha = e.alpha = adjust(e.alpha, 0, 1);
//         }
//
//         obj.filters = f;
//     })(effects, object);
//
//     this.cache();
//
//     function isEqualEffects(effectsA, effectsB) {
//         var diffEffects = [];
//         for (var key in effectsA) {
//             if (effectsA[key] !== effectsB[key]) {
//                 diffEffects.push(key);
//             }
//         }
//         return diffEffects;
//     }
// };

/**
 * Remove all filter
 */
Entry.EntityObject.prototype.resetFilter = function() {
    if (this.parent.objectType !== 'sprite') return;

    var object = this.object;
    object.filters = [];
    this.setInitialEffectValue();
    object.alpha = this.effect.alpha;

    // object.uncache();
    PIXIHelper.createjsUncache(object);

};

/**
 * update dialog position if exist
 */
Entry.EntityObject.prototype.updateDialog = function() {
    if (this.dialog) this.dialog.update();
    Entry.requestUpdate = true;
};

/**
 * save current state data to 'snapshot_'
 */
Entry.EntityObject.prototype.takeSnapshot = function() {
    this.snapshot_ = this.toJSON();
    this.collision = Entry.Utils.COLLISION.NONE;
};

/**
 * load snapshot to current entity
 */
Entry.EntityObject.prototype.loadSnapshot = function() {
    if (this.snapshot_) this.syncModel_(this.snapshot_);
    if (this.parent.objectType === 'sprite')
        this.setImage(this.parent.getPicture());

    Entry.requestUpdate = true;
};

/**
 * Remove itself when this is clone
 */
Entry.EntityObject.prototype.removeClone = function(isLast) {
    if (!this.isClone) return;

    var clonedEntities = this.parent.clonedEntities;

    if (isLast !== true) {
        var index = clonedEntities.indexOf(this);
        if (index > -1) clonedEntities.splice(index, 1);
    } else clonedEntities.pop();

    _.result(this, 'clearExecutor');
    this.destroy(true);
};

Entry.EntityObject.prototype.clearExecutor = function() {
    this.parent.script.clearExecutorsByEntity(this);
};

/**
 * convert this entity's data to JSON.
 * @return {JSON}
 */
Entry.EntityObject.prototype.toJSON = function() {
    var _cut = Entry.cutDecimal;

    var json = {};
    json.x = _cut(this.getX());
    json.y = _cut(this.getY());
    json.regX = _cut(this.getRegX());
    json.regY = _cut(this.getRegY());
    json.scaleX = this.getScaleX();
    json.scaleY = this.getScaleY();
    json.rotation = _cut(this.getRotation());
    json.direction = _cut(this.getDirection());
    json.width = _cut(this.getWidth());
    json.height = _cut(this.getHeight());
    json.font = this.getFont();
    json.visible = this.getVisible();

    if (this.parent.objectType == 'textBox') {
        json.colour = this.getColour();
        json.text = this.getText();
        json.textAlign = this.getTextAlign();
        json.lineBreak = this.getLineBreak();
        json.bgColor = this.getBGColour();
        json.underLine = this.getUnderLine();
        json.strike = this.getStrike();
        json.fontSize = this.getFontSize();
    }
    return json;
};

/*
 * Return initial effect value
 * @return {effect}
 */
Entry.EntityObject.prototype.setInitialEffectValue = function() {
    this.effect = this.getInitialEffectValue();
    Entry.requestUpdate = true;
};

/*
 * Return initial effect value
 * @return {effect}
 */
Entry.EntityObject.prototype.getInitialEffectValue = function() {
    return {
        blur: 0,
        hue: 0,
        hsv: 0,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        alpha: 1,
    };
};

/*
 * remove brush
 */
Entry.EntityObject.prototype.removeBrush = function() {
    this._removeShapes();
    this.brush = null;
};

/*
 * erase brush
 */
Entry.EntityObject.prototype.eraseBrush = function() {
    this._removeShapes();
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype._removeShapes = function() {
    var container = Entry.stage.selectedObjectContainer;
    this.shapes.map(container.removeChild, container);
    this.shapes = [];
};

Entry.EntityObject.prototype.updateBG = function() {
    if (!this.bgObject) return;
    var width = this.getWidth();
    var height = this.getHeight();

    var bgColor = this.getBGColour();
    var hasColor = (bgColor || "").indexOf("#") === 0;

    this.bgObject.alpha = hasColor ? 1 : 0;
    this.bgObject.width = width;
    this.bgObject.height = height;
    this.bgObject.tint = PIXIHelper.colorToUint(bgColor);

    if (this.getLineBreak()) {
        this.bgObject.x = 0;
    } else {
        var fontAlign = this.getTextAlign();
        switch (fontAlign) {
            case Entry.TEXT_ALIGN_LEFT:
                this.bgObject.x = width / 2;
                break;
            case Entry.TEXT_ALIGN_CENTER:
                this.bgObject.x = 0;
                break;
            case Entry.TEXT_ALIGN_RIGHT:
                this.bgObject.x = -width / 2;
                break;
        }
    }





    // if (!this.bgObject) return;
    // this.bgObject.graphics.clear();
    // var width = this.getWidth();
    // var height = this.getHeight();
    // this.bgObject.graphics
    //     .setStrokeStyle(1)
    //     .beginStroke()
    //     .beginFill(this.getBGColour())
    //     .drawRect(-width / 2, -height / 2, width, height);
    // if (this.getLineBreak()) {
    //     this.bgObject.x = 0;
    // } else {
    //     var fontAlign = this.getTextAlign();
    //     switch (fontAlign) {
    //         case Entry.TEXT_ALIGN_LEFT:
    //             this.bgObject.x = width / 2;
    //             break;
    //         case Entry.TEXT_ALIGN_CENTER:
    //             this.bgObject.x = 0;
    //             break;
    //         case Entry.TEXT_ALIGN_RIGHT:
    //             this.bgObject.x = -width / 2;
    //             break;
    //     }
    // }
};

Entry.EntityObject.prototype.alignTextBox = function() {
    if (this.type != 'textBox') return;
    var textObject = this.textObject;

    // if (this.lineBreak) {
    //     textObject.y =
    //         textObject.getMeasuredLineHeight() / 2 - this.getHeight() / 2;

    if (this.lineBreak) {
        textObject.y =
            PIXIHelper.getMeasuredLineHeight(textObject) / 2 - this.getHeight() / 2;

        if (this.fontType == 'Nanum Gothic Coding') {
            textObject.y += 10;
        }

        switch (this.textAlign) {
            case Entry.TEXT_ALIGN_CENTER:
                textObject.x = 0;
                break;
            case Entry.TEXT_ALIGN_LEFT:
                textObject.x = -this.getWidth() / 2;
                break;
            case Entry.TEXT_ALIGN_RIGHT:
                textObject.x = this.getWidth() / 2;
                break;
        }
        textObject.style.maxHeight = this.getHeight();
    } else {
        textObject.x = 0;
        textObject.y = 0;
    }
};

Entry.EntityObject.prototype.syncDialogVisible = function() {
    if (this.dialog) this.dialog.object.visible = this.visible;
};

Entry.EntityObject.prototype.addStamp = function() {
    var stampEntity = new Entry.StampEntity(this.parent, this);
    var stage = Entry.stage;
    stage.loadEntity(
        stampEntity,
        stage.selectedObjectContainer.getChildIndex(this.object)
    );
    this.stamps.push(stampEntity);

    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.removeStamps = function() {
    this.stamps.forEach((s) => s.destroy());
    this.stamps = [];
    Entry.requestUpdate = true;
};

/*
Entry.EntityObject.prototype.destroy = function(isClone) {
    if (this.removed) return;

    this.removed = true;

    var object = this.object;
    if (object) {
        object.uncache();
        object.removeAllEventListeners();
        delete object.image;
        delete object.entity;
    }

    if (this.stamps) this.removeStamps();

    _.result(this.dialog, 'remove');
    this.brush && this.removeBrush();
    Entry.stage.unloadEntity(this);

    var container = Entry.container;
    if (container) {
        container.unCachePictures(this, this.parent.pictures, isClone);
    }
};
*/
Entry.EntityObject.prototype.destroy = function(isClone) {
    if (this.removed) return;

    this.removed = true;

    var object = this.object;
    if (object) {
        object.removeAllListeners();
        delete object.image;
        delete object.entity;
    }

    if (this.stamps) this.removeStamps();

    _.result(this.dialog, 'remove');
    this.brush && this.removeBrush();
    Entry.stage.unloadEntity(this);

    var container = Entry.container;
    if (container) {
        container.unCachePictures(this, this.parent.pictures, isClone);
    }
};

Entry.EntityObject.prototype.cache = function() {
    var { object } = this;
    if (object) {
        //TODO 준배님 createjs cache 이거 어떡합니까?
        // object.cache(0, 0, this.getWidth(), this.getHeight());
        Entry.requestUpdate = true;
    }
};

Entry.EntityObject.prototype.reset = function() {
    this.loadSnapshot();
    this.resetFilter();
    _.result(this.dialog, 'remove');
    this.shapes.length && this.removeBrush();
};
