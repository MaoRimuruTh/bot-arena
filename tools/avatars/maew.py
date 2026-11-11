# Blender (bpy 5.3): "แมววิเชียรมาศ", a chibi Siamese cat sitting up: cream coat with dark brown points, sapphire eyes, a red ribbon and gold bell.
# An original design. Parts hang on named pivots (root, body, head, ear.L, ear.R, tail, paw) for anim.mjs; it faces Blender -Y (+Z in the game).
import bpy, math, os
from mathutils import Vector

OUT = os.environ.get("OUT", os.getcwd())
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.collection

def mat(name, base, metal=0.0, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m
CREAM = mat("cream", (0.86, 0.76, 0.60), 0, 0.7)
POINT = mat("point", (0.20, 0.12, 0.08), 0, 0.65)
EYE = mat("eye", (0.10, 0.35, 0.85), 0, 0.1)
PUPIL = mat("pupil", (0.01, 0.01, 0.02), 0, 0.1)
SHINE = mat("shine", (1, 1, 1), 0, 0.3)
PINK = mat("pink", (0.95, 0.55, 0.62), 0, 0.6)
RIBBON = mat("ribbon", (0.62, 0.04, 0.07), 0, 0.45)
GOLD = mat("gold", (0.93, 0.68, 0.26), 1, 0.3)

def pivot(name, at, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.1; col.objects.link(e); e.location = at
    if parent: e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update(); return e

def hang(o, parent):
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def ball(name, at, rad, m, parent, rot=(0, 0, 0), seg=(14, 9)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = rad; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def cone(name, at, r, depth, m, parent, rot=(0, 0, 0), sc=(1, 1, 1), seg=12):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=0.0, depth=depth, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = sc; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def tube(name, pts, m, parent, res=10):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = 3; cu.resolution_u = res; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y, z, r) in zip(sp.bezier_points, pts): bp.co = (x, y, z); bp.radius = r; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); col.objects.link(o); bpy.context.view_layer.objects.active = o
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target="MESH"); o = bpy.context.object; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return hang(o, parent)

root = pivot("root", (0, 0, 0))
body = pivot("body", (0, 0.02, 0.05), root)
head = pivot("head", (0, -0.06, 0.62), body)
earL = pivot("ear.L", (0.17, -0.04, 1.02), head)
earR = pivot("ear.R", (-0.17, -0.04, 1.02), head)
tail = pivot("tail", (0, 0.27, 0.12), body)
paw = pivot("paw", (0.12, -0.2, 0.42), body)

# sitting body: a pear of cream with a lighter chest, haunches, front legs and dark-point paws
ball("torso", (0, 0.04, 0.33), (0.27, 0.27, 0.31), CREAM, body)
for s in (1, -1): ball(f"haunch{s}", (s * 0.17, 0.08, 0.16), (0.15, 0.2, 0.14), CREAM, body)
ball("leg_r", (-0.11, -0.18, 0.2), (0.07, 0.07, 0.17), CREAM, body)
ball("paw_r", (-0.11, -0.22, 0.04), (0.08, 0.09, 0.05), POINT, body, seg=(10, 6))
ball("leg_l", (0.11, -0.18, 0.2), (0.07, 0.07, 0.17), CREAM, paw)        # the left foreleg can lift to wave
ball("paw_l", (0.11, -0.22, 0.04), (0.08, 0.09, 0.05), POINT, paw, seg=(10, 6))
for s in (1, -1): ball(f"foot{s}", (s * 0.2, -0.04, 0.03), (0.08, 0.11, 0.045), POINT, body, seg=(10, 6))
# head: round and big, a dark mask over the muzzle, sapphire eyes with glints, pink nose
ball("skull", (0, -0.08, 0.82), (0.27, 0.25, 0.23), CREAM, head)
ball("mask", (0, -0.27, 0.77), (0.13, 0.08, 0.1), POINT, head)
ball("nose", (0, -0.34, 0.8), (0.03, 0.018, 0.022), PINK, head, seg=(8, 6))
for s in (1, -1):
    ball(f"eye{s}", (s * 0.105, -0.29, 0.86), (0.055, 0.03, 0.06), EYE, head, seg=(12, 8))
    ball(f"pupil{s}", (s * 0.105, -0.315, 0.86), (0.022, 0.01, 0.045), PUPIL, head, seg=(8, 6))
    ball(f"glint{s}", (s * 0.09, -0.325, 0.885), (0.014, 0.008, 0.014), SHINE, head, seg=(8, 5))
    ball(f"cheek{s}", (s * 0.17, -0.26, 0.76), (0.04, 0.015, 0.028), PINK, head, seg=(10, 6))
# ears: dark-tipped triangles with pink inside, each on its own pivot so they can twitch
for e, s in ((earL, 1), (earR, -1)):
    cone(f"ear{s}", (s * 0.15, -0.05, 1.04), 0.09, 0.2, POINT, e, rot=(0, s * 0.35, 0), sc=(1, 0.55, 1))
    cone(f"earin{s}", (s * 0.148, -0.085, 1.03), 0.055, 0.13, PINK, e, rot=(0, s * 0.35, 0), sc=(1, 0.4, 1))
# a red ribbon at the neck with a little gold bell
ball("collar", (0, -0.02, 0.6), (0.2, 0.19, 0.035), RIBBON, body, seg=(18, 6))
ball("bell", (0, -0.21, 0.56), (0.04, 0.04, 0.04), GOLD, body, seg=(10, 6))
# the tail curls round from behind and up, dark like the points
tube("tail_rope", [(0, 0.27, 0.12, 0.05), (0.15, 0.36, 0.16, 0.045), (0.3, 0.28, 0.32, 0.04), (0.3, 0.12, 0.5, 0.04)], POINT, tail)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "maew_raw.glb"), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False, export_animations=False)
print("faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
