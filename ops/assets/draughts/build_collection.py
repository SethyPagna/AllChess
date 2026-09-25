"""Original turned draughts counters, Blender 5.2, metre scale.

blender --background --python ops/assets/draughts/build_collection.py
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

repo = Path(__file__).resolve().parents[3]
output = repo / 'public/assets/draughts'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, colour, roughness=.38, metal=0):
    mat = bpy.data.materials.new(name); mat.diffuse_color = (*colour, 1); mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = roughness; shader.inputs['Metallic'].default_value = metal
    shader.inputs['Coat Weight'].default_value = .24
    return mat

maple = material('Honey maple', (.76, .57, .32))
wenge = material('Smoked wenge', (.055, .025, .012))
brass = material('Fine brass inlay', (.48, .30, .10), .33, .7)
felt = material('Recessed felt foot', (.022, .046, .033), .95)
gallery = material('Gallery walnut', (.033, .020, .014), .48)
roots = []

def lathe(name, profile, mat, parent, height=0):
    segments = 64
    verts = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z + height) for r, z in profile for i in range(segments)]
    faces = [(j*segments+i, j*segments+(i+1)%segments, (j+1)*segments+(i+1)%segments, (j+1)*segments+i) for j in range(len(profile)-1) for i in range(segments)]
    faces.extend([tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))])
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update(); mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name='Wood grain')
    for polygon in mesh.polygons:
        for index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (vertex.x/.045+.5, vertex.y/.045+.5)
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj); obj.parent = parent
    for polygon in mesh.polygons[:(len(profile)-1)*segments]: polygon.use_smooth = True
    return obj

# Rounded shoulders, side grooves, and a recessed concentric top grip.
profile = [(.0175,.0007),(.0195,.0012),(.0208,.0025),(.021,.0035),(.0205,.004),(.0205,.0046),(.021,.0051),(.021,.0077),(.0208,.0086),(.020,.0097),(.0185,.0107),(.0175,.011),(.016,.011),(.0158,.0103),(.0148,.0103),(.0146,.011),(.0125,.011),(.0123,.0105),(.0116,.0105),(.0114,.011),(.0001,.011)]
for side in ['light', 'dark']:
    for king in [False, True]:
        name = f'{side}_{"king" if king else "man"}'
        parent = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(parent); roots.append(parent)
        for tier in range(2 if king else 1):
            h = tier*.011
            lathe(f'{name} counter {tier+1}', profile, maple if side == 'light' else wenge, parent, h)
            lathe(f'{name} inlay {tier+1}', [(.02055,.00405),(.0206,.00405),(.0206,.0045),(.02055,.0045)], brass, parent, h)
            lathe(f'{name} felt {tier+1}', [(.0158,0),(.0162,.0004),(.0162,.0008)], felt, parent, h)
        parent.location = ((len(roots)-2.5)*.064, 0, 0)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,-.011)); plinth=bpy.context.object
plinth.name='Delivery plinth'; plinth.scale=(.30,.095,.02); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
plinth.data.materials.append(gallery); bevel=plinth.modifiers.new('Soft edge','BEVEL'); bevel.width=.003; bevel.segments=3
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=1200; scene.render.resolution_y=650; scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'
if not scene.world: scene.world=bpy.data.worlds.new('Gallery ambient')
scene.world.color=(.16,.16,.16)
bpy.ops.object.camera_add(location=(.10,-.30,.23)); camera=bpy.context.object; camera.name='Collection delivery camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=.35
camera.rotation_euler=(Vector((0,0,.007))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
for name,position,power,size in [('Key',(-.2,-.2,.4),12,.18),('Fill',(.3,-.1,.3),7,.16),('Rim',(.1,.3,.3),14,.10)]:
    bpy.ops.object.light_add(type='POINT',location=position); obj=bpy.context.object; obj.name=name; obj.data.energy=power; obj.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
bpy.ops.wm.save_as_mainfile(filepath=str(repo/'ops/assets/draughts/collection.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
    parent.select_set(True)
    for child in parent.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(output/'collection.png'); bpy.ops.render.render(write_still=True)
print('Exported four draughts roots with separate physical king stacks')
