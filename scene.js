// utility
class Ray {
    constructor() {
        this.origin = new Vec3();
        this.direction = new Vec3();
    }
}
class Hit {
    constructor() {
        this.reverse_intersect = false;
        this.ptime = 0;
        this.normal = new Ray();
        this.uv = [0, 0];   // create Vec2
    }
}

// technically unecessary base interfaces
class Interactable {
    interacts(src, hit, t_min, t_max) { // Source ray{Ray}, output hit{Hit}, min/max 'times'{numbers}
        return this;
    }
    redirect(src, hit, redirect) {  // Source ray{Ray}, hit point{Hit}, redirected ray{Ray}
        return false;               // returns if redirect happened
    }
    emmision(hit) { // Hit point{Hit} -- if the UV coords are not generated, they will be within this function, and then used
        return 0;
    }
    albedo(hit) {   // Hit point{Hit}
        return new Vec3();
    }
    invokeMenu() {  // may need to pass in some sort of context, or just do this completely differently --> returns if anything was updated
        return false;
    }
}
class Material {
    redirect(src, hit, redirect) {  // Identical to the method within Interactable, although this is the underlying worker
        return false;
    }
    invokeMenu() {
        return false;
    }
}
class Texture {
    albedo(uv) {    // underlying worker for Interactable --> converts UV coords to color
        return new Vec3();
    }
    invokeMenu() {
        return false;
    }
}


// Property implementations
class PhysicalBase extends Material {
    constructor(roughness = 1, glossiness = 0, transparency = 0, refr_index = 1) {
        super();
        this.roughness = roughness;
        this.glossiness = glossiness;
        this.transparency = transparency;
        this.refraction_index = refr_index;
    }

    static DEFAULT = new PhysicalBase(1, 0, 0, 1);

    redirect(src, hit, redirect) {
        let seed = Math.random();
        if(seed < this.roughness) {
            return PhysicalBase.diffuse(hit.normal, redirect);
        } else if(seed < this.transparency) {
            return PhysicalBase.refract(src, hit, this.refraction_index, redirect, this.glossiness);
        } else {
            return PhysicalBase.reflect(src, hit, redirect, this.glossiness);
        }
    }
    invokeMenu() {

    }

    static diffuse(normal, redirect) {
        redirect.origin = normal.origin;
        redirect.direction = normal.direction + Vec3.randomInUnitSphere();
        if( // if the random direction exactly inverts the normal, reset to normal direction
            Math.abs(redirect.direction.x) < CCT.EPSILON &&
            Math.abs(redirect.direciton.y) < CCT.EPSILON &&
            Math.abs(redirect.direciton.z) < CCT.EPSILON
        ) {
            redirect.direction = normal.direction;
        }
        return true;
    }
    static reflect(src, hit, redirect, gloss) {
        gloss = gloss || 0;
        redirect.direction = hit.normal.direction;
        redirect.direction = Vec3._sub( // (in - norm * dot(norm, in) * 2) + (random * glossiness)
            src.direction, Vec3._scale(
                hit.normal.direction,
                Vec3._dot(hit.normal.direction, src.direction) * 2)
        ).add(Vec3.randomInUnitSphere().scale(gloss));
        return redirect.direction.dot(hit.normal.direction) > 0;
    }
    static reflectance(cos, ir) {
        return Math.pow( ((1 - ir) / (1 + ir)), 2) +
            ((1 - ir) * Math.pow( (1 - cos), 5));
    }
    static refract(src, hit, refr_index, redirect, gloss) {
        let cos_theta = Math.min((Vec3._negate(src.direction).dot(hit.normal.direction) * 2), 1);
        let sin_theta = Math.sqrt(1 - cos_theta * cos_theta);
        refr_index = hit.reverse_intersect ? refr_index : (1 / refr_index);
        if(refr_index * sin_theta > 1 ||
            this.reflectance(cos_theta, refr_index) > Math.random() // the higher the reflectance, the more likely to reflect (but still random)
        ) {
            return this.reflect(src, hit, redirect, gloss);
        }
        let r_out_perp = Vec3._scale(hit.normal.direction, cos_theta).add(src.direction).scale(refr_index);
        let r_out_para = Vec3._scale(hit.normal.direction, -Math.sqrt(Math.abs(1 - Vec3._dot(r_out_per, r_out_perp))));
        redirect.direction = Vec3._add(r_out_perp, r_out_para);
        redirect.origin = hit.normal.origin;
        return true;
    }
}
class StaticTexture extends Texture {
    constructor(color = 0.5) {
        super();
        this.color = new Vec3(color);
    }

    static DEFAULT = new StaticTexture(0.5);

    albedo(uv) {
        return this.color.clone();
    }
}
class ImageTexture extends Texture {
    // currently not an important feature
}

// Object implementations
class Sphere extends Interactable {
    constructor(pos, rad, material = PhysicalBase.DEFAULT, texture = StaticTexture.DEFAULT, lum = 0) {
        super();
        this.position = new Vec3(pos);
        this.radius = rad || 0.5;
        this.material = material;
        this.texture = texture;
        this.luminance = lum || 0;
    }

    interacts(src, hit, t_min = CCT.EPSILON, t_max = Number.POSITIVE_INFINITY) {
        let o = Vec3._sub(src.origin, this.position);
        let a = Vec3._dot(src.direction, src.direction);
        let b = 2 * Vec3._dot(o, src.direction);
        let c = Vec3._dot(o, o) - (this.radius * this.radius);
        let d = (b * b) - (4 * a * c);
        if(d < 0)
            { return null; }
        hit.ptime = (Math.sqrt(d) + b) / (-2 * a);
        if(hit.ptime < t_min || hit.ptime > t_max)
            { return null; }
        hit.normal.origin = Vec3._scale(src.direction, hit.ptime).add(src.origin);
        hit.normal.direction = Vec3._sub(hit.normal.origin, this.position).normalize();
        if(hit.reverse_intersect = (hit.normal.direction.dot(src.direction)) > 0) {
            hit.normal.direction.negate();
        }
        return this;
    }
    redirect(src, hit, redirect) {
        return this.material ? this.material.redirect(src, hit, redirected) : false;
    }
    emmision(hit) {
        return this.luminance;
    }
    albedo(hit) {
        if(!this.texture) {
            return new Vec3();
        }
        if(hit.uv[0] == -1 && hit.uv[1] == -1) {    // convert hit point to UV coord
            hit.uv[0] = (Math.atan2(-hit.normal.direction.z, hit.normal.direction.x) + Math.PI) / (2 * Math.PI);
            hit.uv[1] = Math.acos(-hit.normal.direction.y) / Math.PI;
        }
        return this.texture.albedo(hit.uv);
    }
    invokeMenu() {

    }

}
class Triangle extends Interactable {
    constructor() {
        super();
    }
}
class Quad extends Interactable {
    constructor() {
        super();
    }
}