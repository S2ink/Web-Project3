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



class Vec4 {
    constructor(x, y, z, w) {
        if(x instanceof Vec4) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            this.w = x.w;
        } else if(x instanceof CCT.Vector3) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            this.w = 0;
            if(typeof(y) === 'number') {
                this.w = y;
            }
        } else if(x instanceof Array && x.length <= 4) {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2];
            this.w = x[3];
        } else if(x && y === undefined && z === undefined && w === undefined) {
            this.x = x;
            this.y = x;
            this.z = x;
            this.w = x;
        } else {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
            this.w = w || 0;
        }
    }

    clone() {
        return new Vec4(this);
    }
    toArray() {
        return [this.x, this.y, this.z, this.w];
    }
    fromArray(arr, off = 0) {
        this.x = arr[off];
        this.y = arr[off + 1];
        this.z = arr[off + 2];
        this.w = arr[off + 3];
        return this;
    }
    toVec3() {
        return new Vec3(this.x, this.y, this.z);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        this.w += v.w;
        return this;
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        this.w -= v.w;
        return this;
    }
    iMul(v) {
        this.x *= v.x;
        this.y *= v.y;
        this.z *= v.z;
        this.w *= v.w;
        return this;
    }
    iDiv(v) {
        this.x /= v.x;
        this.y /= v.y;
        this.z /= v.z;
        this.w /= v.w;
        return this;
    }
    scale(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        this.w *= s;
        return this;
    }
    dot(v) {
        return Vec4._dot(this, v);
    }
    negate() {
        this.x *= -1;
        this.y *= -1;
        this.z *= -1;
        this.w *= -1;
        return this;
    }
    lengthSqr() {
        return Vec4._lenSqr(this);
    }
    length() {
        return Vec4._length(this);
    }

    static _add(a, b) { return new Vec4(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w); }
    static _sub(a, b) { return new Vec4(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w); }
    static _iMul(a, b) { return new Vec4(a.x * b.x, a.y * b.y, a.z * b.z, a.w * b.w); }
    static _iDiv(a, b) { return new Vec4(a.x / b.x, a.y / b.y, a.z / b.z, a.w / b.w); }
    static _scale(v, s) { return new Vec4(v.x * s, v.y * s, v.z * s, v.w * s); }
    static _dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w; }
    static _negate(v) { return new Vec4(-v.x, -v.y, -v.z, -v.w); }
    static _lenSqr(v) { return this._dot(v, v); }
    static _length(v) { return Math.sqrt(this._lenSqr(v)); }
    static _fromArray(arr, off = 0) { return new Vec4().fromArray(arr, off); }

}
class Quat extends Vec4 {
    constructor(w, x, y, z) {
        if(w instanceof Vec4 || w instanceof CCT.Vector3 || w instanceof Array ||
            (w && x === undefined && y === undefined && z === undefined)
        ) {
            super(w, x, y, z);
        } else {
            super(x, y, z, w);
        }
    }
}



function angleAxis(angle, axis) {
    let s = Math.sin(angle * 0.5);
    let v = Vec3._scale(axis, s);
    return [Math.cos(angle * 0.5), v.x, v.y, v.z];
}



class Mat4 extends Array {
    constructor(a, b, c, d) {
        super(4);
        if(a instanceof Vec4) {
            this[0] = a.toArray().slice();
        } else if(a instanceof Array) {
            if(a.length == 4) {
                // if(a[0] instanceof Array && a[0].length == 4) {
                //     this[0] = a[0].slice();
                //     this[1] = a[1].slice();
                //     this[2] = a[2].slice();
                //     this[3] = a[3].slice();
                //     return;
                // } else {
                    this[0] = a.slice();
                //}
            } else if(a.length == 16) {
                this[0] = a.slice(0, 4);
                this[1] = a.slice(4, 8);
                this[2] = a.slice(8, 12);
                this[3] = a.slice(12, 16);
                return;
            }
        } else if(a && b === undefined && c === undefined && d === undefined) {
            this[0] = [a, a, a, a];
            this[1] = [a, a, a, a];
            this[2] = [a, a, a, a];
            this[3] = [a, a, a, a];
            return;
        } else {
            this[0] = new Array(4).fill(a || 0);
        }
        if(b instanceof Vec4) {
            this[1] = b.toArray().slice();
        } else if(b instanceof Array && b.length == 4) {
            this[1] = b.slice();
        } else {
            this[1] = new Array(4).fill(b || 0);
        }
        if(c instanceof Vec4) {
            this[2] = c.toArray().slice();
        } else if(c instanceof Array && c.length == 4) {
            this[2] = c.slice();
        } else {
            this[2] = new Array(4).fill(c || 0);
        }
        if(d instanceof Vec4) {
            this[3] = d.toArray().slice();
        } else if(d instanceof Array && d.length == 4) {
            this[3] = d.slice();
        } else {
            this[3] = new Array(4).fill(b || 0);
        }
    }

    clone() {
        return new Mat4(
            this[0],
            this[1],
            this[2],
            this[3]
        );
    }
    copy(m) {
        this[0] = m[0];
        this[1] = m[1];
        this[2] = m[2];
        this[3] = m[3];
        return this;
    }
    scale(s) {
        for(let c = 0; c < 4; c++) {
            for(let r = 0; r < 4; r++) {
                this[c][r] *= s;
            }
        }
        return this;
    }
    inverse() {
        return this.copy(Mat4._inverse(this));
    }

    mulVec4(v) {
        return mat4vec(this, v);
    }
    mulMat4(m) {
        return this;
    }
    mul(x) {
        if(x instanceof Vec4) {
            return this.mulVec4(x);
        } else if(x instanceof Mat4) {
            return this.mulMat4(x);
        }
        return null;
    }

    static _inverse(m) {
        let Coef00 = m[2][2] * m[3][3] - m[3][2] * m[2][3];
        let Coef02 = m[1][2] * m[3][3] - m[3][2] * m[1][3];
        let Coef03 = m[1][2] * m[2][3] - m[2][2] * m[1][3];
    
        let Coef04 = m[2][1] * m[3][3] - m[3][1] * m[2][3];
        let Coef06 = m[1][1] * m[3][3] - m[3][1] * m[1][3];
        let Coef07 = m[1][1] * m[2][3] - m[2][1] * m[1][3];
    
        let Coef08 = m[2][1] * m[3][2] - m[3][1] * m[2][2];
        let Coef10 = m[1][1] * m[3][2] - m[3][1] * m[1][2];
        let Coef11 = m[1][1] * m[2][2] - m[2][1] * m[1][2];
    
        let Coef12 = m[2][0] * m[3][3] - m[3][0] * m[2][3];
        let Coef14 = m[1][0] * m[3][3] - m[3][0] * m[1][3];
        let Coef15 = m[1][0] * m[2][3] - m[2][0] * m[1][3];
    
        let Coef16 = m[2][0] * m[3][2] - m[3][0] * m[2][2];
        let Coef18 = m[1][0] * m[3][2] - m[3][0] * m[1][2];
        let Coef19 = m[1][0] * m[2][2] - m[2][0] * m[1][2];
    
        let Coef20 = m[2][0] * m[3][1] - m[3][0] * m[2][1];
        let Coef22 = m[1][0] * m[3][1] - m[3][0] * m[1][1];
        let Coef23 = m[1][0] * m[2][1] - m[2][0] * m[1][1];
    
        let Fac0 = new Vec4(Coef00, Coef00, Coef02, Coef03);
        let Fac1 = new Vec4(Coef04, Coef04, Coef06, Coef07);
        let Fac2 = new Vec4(Coef08, Coef08, Coef10, Coef11);
        let Fac3 = new Vec4(Coef12, Coef12, Coef14, Coef15);
        let Fac4 = new Vec4(Coef16, Coef16, Coef18, Coef19);
        let Fac5 = new Vec4(Coef20, Coef20, Coef22, Coef23);
    
        let vec0 = new Vec4(m[1][0], m[0][0], m[0][0], m[0][0]);
        let vec1 = new Vec4(m[1][1], m[0][1], m[0][1], m[0][1]);
        let vec2 = new Vec4(m[1][2], m[0][2], m[0][2], m[0][2]);
        let vec3 = new Vec4(m[1][3], m[0][3], m[0][3], m[0][3]);

        let Inv0 = Vec4._iMul(vec1, Fac0).sub(Vec4._iMul(vec2, Fac1)).add(Vec4._iMul(vec3, Fac2));	// these multiplies are per-element and non-matrix resultant
        let Inv1 = Vec4._iMul(vec0, Fac0).sub(Vec4._iMul(vec2, Fac3)).add(Vec4._iMul(vec3, Fac4));
        let Inv2 = Vec4._iMul(vec0, Fac1).sub(Vec4._iMul(vec1, Fac3)).add(Vec4._iMul(vec3, Fac5));
        let Inv3 = Vec4._iMul(vec0, Fac2).sub(Vec4._iMul(vec1, Fac4)).add(Vec4._iMul(vec2, Fac5));

        let SignA = new Vec4(+1, -1, +1, -1);
        let SignB = new Vec4(-1, +1, -1, +1);
        let Col0 = Vec4._iMul(Inv0, SignA).toArray();
        let Col1 = Vec4._iMul(Inv1, SignB).toArray();
        let Col2 = Vec4._iMul(Inv2, SignA).toArray();
        let Col3 = Vec4._iMul(Inv3, SignB).toArray();
        let Inverse = new Mat4(Col0, Col1, Col2, Col3);
        
        let Row0 = new Vec4(Inverse[0][0], Inverse[1][0], Inverse[2][0], Inverse[3][0]);
    
        let Dot0 = Row0.iMul(new Vec4(m[0]));
        let Dot1 = (Dot0.x + Dot0.y) + (Dot0.z + Dot0.w);
    
        let OneOverDeterminant = 1.0 / Dot1;
    
        return Inverse.scale(OneOverDeterminant);
    }

}

Vec4.prototype.mulVec4 = function(v) {
    return vec4vec(this, x);
}
Vec4.prototype.mulMat4 = function(m) {
    this.x = m[0][0] * this.x + m[0][1] * this.y + m[0][2] * this.z + m[0][3] * this.w;
    this.y = m[1][0] * this.x + m[1][1] * this.y + m[1][2] * this.z + m[1][3] * this.w;
    this.z = m[2][0] * this.x + m[2][1] * this.y + m[2][2] * this.z + m[2][3] * this.w;
    this.w = m[3][0] * this.x + m[3][1] * this.y + m[3][2] * this.z + m[3][3] * this.w;
    return this;
}
Vec4.prototype.mul = function(x) {
    if(x instanceof Vec4) {
        return this.mulVec4(x);
    } else if(x instanceof Mat4) {
        return this.mulMat4(x);
    }
    return null;
}

function vec4vec(a, b) {

}
function vec4mat(v, m) {
    return new Vec4(
        m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z + m[0][3] * v.w,
        m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z + m[1][3] * v.w,
        m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z + m[2][3] * v.w,
        m[3][0] * v.x + m[3][1] * v.y + m[3][2] * v.z + m[3][3] * v.w
    );
}
function mat4vec(m, v) {
    return new Vec4(
        m[0][0] * v.x + m[1][0] * v.y + m[2][0] * v.z + m[3][0] * v.w,
		m[0][1] * v.x + m[1][1] * v.y + m[2][1] * v.z + m[3][1] * v.w,
		m[0][2] * v.x + m[1][2] * v.y + m[2][2] * v.z + m[3][2] * v.w,
		m[0][3] * v.x + m[1][3] * v.y + m[2][3] * v.z + m[3][3] * v.w
    );
}
function mat4mat(a, b) {

}
function mul4(a, b) {
    if(a instanceof Vec4) {
        if(b instanceof Vec4) {
            return vec4vec(a, b);
        } else if(b instanceof Mat4) {
            return vec4mat(a, b);
        }
    } else if(a instanceof Mat4) {
        if(b instanceof Vec4) {
            return mat4vec(a, b);
        } else if(b instanceof Mat4) {
            return mat4mat(a, b);
        }
    }
    return null;
}