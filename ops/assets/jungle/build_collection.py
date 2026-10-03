"""Original AllChess animal miniatures. Blender 5.2; metre scale, no external assets."""
import bpy, math
from pathlib import Path
from mathutils import Vector
repo=Path(__file__).resolve().parents[3]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.4,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
def finish(o,name,m,parent):
    o.name=name;o.data.materials.append(m);o.parent=parent
    for p in o.data.polygons:p.use_smooth=True
    return o
def ball(name,xyz,scale,m,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=xyz)
    o=finish(bpy.context.object,name,m,parent);o.scale=scale;return o
def cone(name,xyz,r1,r2,depth,m,parent):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=depth,location=xyz)
    return finish(bpy.context.object,name,m,parent)
def tube(name,points,radius,m,parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8;curve.bevel_depth=radius;curve.bevel_resolution=1
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
ivory=mat('Warm ivory resin',(.79,.70,.50),.32);jade=mat('Deep jade resin',(.018,.105,.075),.3)
brass=mat('Brass inlay',(.55,.34,.10),.28,.72);ink=mat('Obsidian ink details',(.012,.016,.014),.4)
roots=[]
for side,y,material in [('light',-.035,ivory),('dark',.035,jade)]:
 for i,name in enumerate(['rat','cat','wolf','dog','leopard','tiger','lion','elephant']):
    root=bpy.data.objects.new(f'{side}_{name}',None);bpy.context.collection.objects.link(root);roots.append(root)
    radius=.014 if i<4 else .017
    cone('Foot',(0,0,.002),radius,radius,.004,material,root)
    cone('Brass inlay',(0,0,.0027),radius*1.005,radius*1.005,.0008,brass,root)
    if name=='rat':
        ball('Low rat body',(0,-.002,.011),(.007,.011,.007),material,root)
        ball('Pointed rat muzzle',(0,.011,.013),(.0045,.008,.004),material,root)
        for x in [-.0045,.0045]:ball('Round rat ear',(x,.004,.019),(.004,.002,.004),material,root)
        tube('Rat tail',[(0,-.009,.009),(.010,-.016,.005),(.014,-.008,.005),(.009,-.004,.006)],.0011,material,root)
    elif name=='elephant':
        for x in [-.007,.007]:
            for yy in [-.008,.008]:cone('Elephant leg',(x,yy,.012),.004,.0035,.016,material,root)
        ball('Elephant body',(0,-.002,.025),(.012,.016,.014),material,root)
        ball('Elephant head',(0,.014,.033),(.010,.009,.011),material,root)
        for x in [-.011,.011]:ball('Elephant ear',(x,.008,.034),(.005,.003,.012),material,root)
        tube('Curved trunk',[(0,.020,.036),(0,.023,.025),(0,.022,.013),(0,.016,.013)],.003,material,root)
        for x in [-.006,.006]:tube('Brass tusk',[(x,.019,.029),(x,.024,.025),(x,.024,.029)],.0012,brass,root)
    else:
        big=name in ['leopard','tiger','lion'];s=1.15 if big else 1
        if big:
            for x in [-.007,.007]:
                for yy in [-.010,.010]:cone('Animal leg',(x,yy,.012),.0035,.003,.016,material,root)
            ball('Long cat body',(0,-.002,.023),(.010,.016,.009),material,root)
        else:
            ball('Seated haunch',(0,-.003,.015),(.009,.009,.011),material,root)
            for x in [-.004,.004]:cone('Front paw',(x,.007,.012),.0028,.002,.016,material,root)
            ball('Upright chest',(0,.002,.024),(.006,.007,.013),material,root)
        head=(0,.012,.032*s)
        if name=='lion':
            ball('Lion mane',(0,.008,.034),(.014,.009,.016),material,root)
            for j in range(10):
                a=j*math.tau/10;ball('Mane lock',(math.cos(a)*.011,.011,.034+math.sin(a)*.012),(.003,.004,.005),material,root)
        ball('Animal head',head,(.008*s,.008*s,.008*s),material,root)
        snout=.007 if name=='wolf' else .005 if name=='dog' else .003
        ball('Muzzle',(0,.019,.030*s),(.004,snout,.0035),material,root)
        if name=='dog':
            for x in [-.008,.008]:ball('Drooping dog ear',(x,.011,.027),(.003,.004,.010),material,root)
            cone('Brass inlay collar',(0,.004,.028),.007,.007,.0015,brass,root)
        elif name in ['cat','wolf']:
            for x in [-.006,.006]:cone('Pointed ear',(x,.011,.042),.003,0,.009,material,root)
        else:
            for x in [-.007,.007]:ball('Round cat ear',(x,.011,.043),(.003,.002,.003),material,root)
        for x in [-.005,.005]:ball('Obsidian ink eye',(x,.018,.034*s),(.0012,.0012,.0012),ink,root)
        tailpoints=[(0,-.012,.019),(.010,-.021,.012),(.015,-.017,.016)]
        tube('Animal tail',tailpoints,.0028 if name=='wolf' else .0017,material,root)
        if name=='lion':ball('Lion tail tuft',tailpoints[-1],(.003,.003,.004),material,root)
        if name=='tiger':
            for yy in [-.010,-.003,.004]:tube('Tiger stripe',[(-.009,yy,.026),(0,yy,.032),(.009,yy,.026)],.0009,brass,root)
        if name=='leopard':
            for x in [-.007,.007]:
                for yy in [-.010,-.003,.004]:ball('Leopard spot',(x,yy,.029),(.0016,.0017,.0008),brass,root)
    root.location=((i-3.5)*.052,y,0)
# A reusable editable studio; only animal hierarchies are exported.
plinth=mat('Studio stone',(.035,.06,.047),.5)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.009));o=bpy.context.object;o.dimensions=(.44,.15,.018);o.data.materials.append(plinth)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1500;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG';scene.world.color=(.18,.18,.18)
bpy.ops.object.camera_add(location=(.19,.38,.25));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=.49;camera.rotation_euler=(Vector((0,0,.020))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for pos,power,size in [((-.22,-.25,.4),10,.18),((.3,-.03,.24),6,.16),((0,.2,.32),9,.12)]:
    bpy.ops.object.light_add(type='POINT',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
out=repo/'public/assets/jungle';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(repo/'ops/assets/jungle/collection.blend'))
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for child in root.children:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(out/'collection.png');bpy.ops.render.render(write_still=True)
