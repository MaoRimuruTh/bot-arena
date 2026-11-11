# Blender (bpy 5.3): a dim Thai hall rendered as an equirectangular HDR, used only for reflections in the gold, brass and lacquer.
# Dark teak floor and ceiling, red-lacquer columns with gilded bands, hanging lanterns and floor candles for warm highlights.
import bpy, math, random, os
OUT = os.environ.get("OUT", os.getcwd()); W = int(os.environ.get("W", "1024")); SAMPLES = int(os.environ.get("SAMPLES", "64"))
random.seed(9)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True

def mat(name, base, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = strength
    return m

def put(ob, m): ob.data.materials.append(m); return ob
TEAK = mat("teak", (0.09, 0.04, 0.02), 0, 0.45)
LAC = mat("lacquer", (0.22, 0.02, 0.015), 0, 0.3)
GILT = mat("gilt", (0.9, 0.62, 0.25), 1, 0.35)
PAPER = mat("lantern", (1, 0.7, 0.35), 0, 0.8, (1.0, 0.55, 0.22), 18)
FLAME = mat("flame", (1, 0.6, 0.3), 0, 0.5, (1.0, 0.62, 0.3), 60)

bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.4)); put(bpy.context.object, TEAK)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 15)); put(bpy.context.object, TEAK)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=27, depth=16, location=(0, 0, 7.5)); wall = put(bpy.context.object, LAC)
for k in range(10):
    a = k / 10 * 2 * math.pi + 0.2; x, y = math.cos(a) * 16, math.sin(a) * 16
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.75, depth=15.4, location=(x, y, 7.3)); put(bpy.context.object, LAC)
    for z in (1.0, 6.5, 12.5):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.82, depth=0.35, location=(x, y, z)); put(bpy.context.object, GILT)
# beams across the ceiling, gilded edges catching the lantern light
for k in range(6):
    a = k / 6 * math.pi
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 13.6)); b = bpy.context.object; b.scale = (54, 0.6, 0.8); b.rotation_euler = (0, 0, a); put(b, TEAK)
# hanging lanterns at two heights, and clusters of floor candles further out
for k in range(9):
    a = k / 9 * 2 * math.pi + random.uniform(-0.2, 0.2); d = random.uniform(8, 12)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.55, location=(math.cos(a) * d, math.sin(a) * d, random.uniform(6.5, 9.5)))
    o = bpy.context.object; o.scale = (1, 1, 1.35); put(o, PAPER)
for k in range(14):
    a = random.uniform(0, 2 * math.pi); d = random.uniform(9, 14)
    for j in range(3):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.07, location=(math.cos(a) * d + random.uniform(-0.4, 0.4), math.sin(a) * d + random.uniform(-0.4, 0.4), random.uniform(0.6, 1.4)))
        put(bpy.context.object, FLAME)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.0
bpy.ops.object.camera_add(location=(0, 0, 1.5), rotation=(math.pi / 2, 0, 0)); cam = bpy.context.object; sc.camera = cam
cam.data.type = "PANO"; cam.data.panorama_type = "EQUIRECTANGULAR"
sc.render.resolution_x = W; sc.render.resolution_y = W // 2; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "HDR"; sc.render.filepath = os.path.join(OUT, "hall.hdr")
bpy.ops.render.render(write_still=True)
print("hall rendered")
