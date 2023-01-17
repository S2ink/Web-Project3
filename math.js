const { vec2, vec3, vec4, quat, mat2, mat3, mat4 } = glMatrix;

const Vec2 = vec2.fromValues;
const Vec3 = vec3.fromValues;
const Vec4 = vec4.fromValues;
const Quat = quat.fromValues;

function calcRayDirection(wh_prop, iproj, iview) {
	let t = vec4.transformMat4(
		vec4.create(),
		vec4.fromValues(wh_prop[0]*2-1, wh_prop[1]*2-1, 1, 1),
		iproj
	);
	let s = vec3.fromValues(t[0]/t[3], t[1]/t[3], t[2]/t[3]);
	vec3.normalize(s, s);
	let r = vec4.transformMat4(
		vec4.create(),
		vec4.fromValues(s[0], s[1], s[2], 0),
		iview
	);
	return vec3.fromValues(r[0], r[1], r[2]);
}

Float32Array.prototype.concat = function() {
    var bytesPerIndex = 4,
        buffers = Array.prototype.slice.call(arguments);

    // add self
    buffers.unshift(this);

    buffers = buffers.map(function (item) {
        if (item instanceof Float32Array) {
            return item.buffer;
        } else if (item instanceof ArrayBuffer) {
            if (item.byteLength / bytesPerIndex % 1 !== 0) {
                throw new Error('One of the ArrayBuffers is not from a Float32Array');
            }
            return item;
        } else {
            throw new Error('You can only concat Float32Array, or ArrayBuffers');
        }
    });

    var concatenatedByteLength = buffers
        .map(function (a) {return a.byteLength;})
        .reduce(function (a,b) {return a + b;}, 0);

    var concatenatedArray = new Float32Array(concatenatedByteLength / bytesPerIndex);

    var offset = 0;
    buffers.forEach(function (buffer, index) {
        concatenatedArray.set(new Float32Array(buffer), offset);
        offset += buffer.byteLength / bytesPerIndex;
    });

    return concatenatedArray;
};