class Vec3 extends CCT.Vector3 {

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }
    mul(v) {
        this.x *= (v.x ?? v);
        this.y *= (v.y ?? v);
        this.z *= (v.z ?? v);
        return this;
    }
    div(v) {
        this.x / (v.x ?? v);
        this.y / (v.y ?? v);
        this.z / (v.z ?? v);
        return this;
    }
    dot(v) {
        return super.dot(v);
    }

}