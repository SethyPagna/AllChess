"""Original pebble meshes for Kōnane. Blender 5.2; metre scale; no imported assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

repo = Path(__file__).resolve().parents[3]
output = repo / 'public/assets/konane'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, colour, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

roots = []
for side, colour, roughness, phase in [('light', (.83,.77,.64), .57, .7), ('dark', (.035,.042,.043), .72, 2.3)]:
    parent = bpy.data.objects.new(f'{side}_stone', None)
    bpy.context.collection.objects.link(parent)
    roots.append(parent)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1)
    stone = bpy.context.object
    stone.name = f'{side} rounded pebble'
    stone.parent = parent
    for vertex in stone.data.vertices:
        x,y,z = vertex.co
        # Broad asymmetry and tiny surface irregularities survive portable glTF.
        broad = 1 + .035*math.sin(x*3+y*2+phase)*math.cos(z*3-phase)
        texture = 1 + .005*math.sin(x*83+y*57+z*29+phase)
        vertex.co = (x*.0185*broad*texture, y*.0175*broad*texture, z*.008*broad*texture)
    floor = min(v.co.z for v in stone.data.vertices)
    for vertex in stone.data.vertices: vertex.co.z -= floor
    stone.data.materials.append(material('Coral-tone stone' if side == 'light' else 'Basalt-tone stone', colour, roughness))
    for polygon in stone.data.polygons: polygon.use_smooth = True
    parent.location.x = -.031 if side == 'light' else .031

bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,-.012))
plinth = bpy.context.object
plinth.name = 'Delivery plinth'
plinth.scale = (.16,.09,.024)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
plinth.data.materials.append(material('Warm timber',(.22,.10,.035),.48))
bevel=plinth.modifiers.new('Rounded edge','BEVEL'); bevel.width=.004; bevel.segments=3
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1200; scene.render.resolution_y=750; scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'
if not scene.world: scene.world=bpy.data.worlds.new('Studio ambient')
scene.world.color=(.16,.16,.16)
bpy.ops.object.camera_add(location=(.09,-.19,.15))
camera=bpy.context.object; camera.name='Delivery camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=.19
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
for name,position,power,size in [('Key',(-.2,-.2,.4),12,.18),('Fill',(.3,-.1,.3),7,.16),('Rim',(.1,.3,.3),14,.10)]:
    bpy.ops.object.light_add(type='POINT',location=position)
    obj=bpy.context.object; obj.name=name; obj.data.energy=power; obj.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
bpy.ops.wm.save_as_mainfile(filepath=str(repo/'ops/assets/konane/collection.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
    parent.select_set(True)
    for child in parent.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(output/'collection.png')
bpy.ops.render.render(write_still=True)
