#version 300 es

#define EPSILON 0.00001
#define PI 3.1415926538

struct Ray {
	vec3 origin;
	vec3 direction;
};
struct Hit {
	bool reverse_intersect;
	float time;
	Ray normal;
	vec2 uv;
};