class Vec3 extends CCT.Vector3 {
    constructor(x, y, z) {
        if(x instanceof CCT.Vector3) {
            super(x.x, x.y, x.z);
        } else if(x instanceof Array && x.length >= 3) {
            super(x[0], x[1], x[2]);
        } else if(typeof(x) === 'number' && y === undefined && z === undefined) {
            super(x, x, x);
        } else {
            super(x, y, z);
        }
    }

    toArray() { return [this.x, this.y, this.z]; }
    add(v) { // add
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    // addScaled --> super
    // sub --> super
    // negate --> super
    // dot --> super
    // len/lenSq --> super
    // scale/invscale --> super
    scale(s) { return super.multiplyScalar(s); }
    cross(v) {
        this.x = this.y * v.z - this.z * v.y;
        this.y = this.z * v.x - this.x * v.z;
        this.z = this.x * v.y - this.y * v.x;
        return this;
    }

    static _add(a, b) { return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
    static _sub(a, b) { return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
    static _iMul(a, b) { return new Vec3(a.x * b.x, a.y * b.y, a.z * b.z); } // element-wise multiply
    static _iDiv(a, b) { return new Vec3(a.x / b.x, a.y / b.y, a.z / b.z); } // element-wise divide
    static _scale(a, s) { return new Vec3(a.x * s, a.y * s, a.z * s); }
    static _dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    static _cross(a, b) { return new Vec3().crossVectors(a, b); }
    static _negate(v) { return new Vec3(v).negate(); }
    static randomInUnitSphere() {
        return new Vec3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
        ).normalize();
    }
}
Vec3.prototype.clone = function() {
    return new Vec3(this);
}

function angleAxis(angle, axis) {
    let s = Math.sin(angle * 0.5);
    let v = Vec3._scale(axis, s);
    return [Math.cos(angle * 0.5), v.x, v.y, v.z];
}

class Vec4 {
    constructor(x, y, z, w) {
        if(x instanceof Vec4) {
            this.arr = x.arr.slice();
        } else if(x instanceof CCT.Vector3) {
            this.arr = [x.x, x.y, x.z, 0];
            if(y instanceof Number) {
                this.arr[3] = y;
            }
        } else if(x instanceof Array && x.length == 4) {
            this.arr = x;
        } else {
            this.arr = [
                x || 0,
                y || 0,
                z || 0,
                w || 0
            ];
        }
    }

    get x() { return this.arr[0]; }
    set x(v) { this.arr[0] = v; }
    get y() { return this.arr[1]; }
    set y(v) { this.arr[1] = v; }
    get z() { return this.arr[2]; }
    set z(v) { this.arr[2] = v; }
    get w() { return this.arr[3]; }
    set w(v) { this.arr[3] = v; }
    
}