"""Original AllChess historical interpretations. Blender 5.2, metre scale.
Rebuild: blender --background --python ops/assets/historical/build_collections.py
No imported meshes, images, fonts or textures. Not museum replicas.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector
repo=Path(__file__).resolve().parents[3]

def material(name,color,rough=.4,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m

def finish(obj,name,mat,parent,smooth=False):
    obj.name=name;obj.data.materials.append(mat);obj.parent=parent
    for p in obj.data.polygons:p.use_smooth=smooth
    return obj

def box(name,xyz,dimensions,mat,parent,bevel=.001):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz);obj=finish(bpy.context.object,name,mat,parent);obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Soft carved edges','BEVEL');mod.width=bevel;mod.segments=3
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj

def ball(name,xyz,scale,mat,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=xyz)
    obj=finish(bpy.context.object,name,mat,parent,True);obj.scale=scale
    return obj

def lathe(name,profile,mat,parent,segments=32):
    verts=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for r,z in profile for i in range(segments)]
    faces=[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i) for j in range(len(profile)-1) for i in range(segments)]
    faces += [tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);finish(obj,name,mat,parent,True)
    return obj

def silhouette(name,profile,thickness,mat,parent):
    verts=[(x,y,z) for x in [-thickness/2,thickness/2] for y,z in profile];n=len(profile)
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);finish(obj,name,mat,parent)
    mod=obj.modifiers.new('Rounded carving','BEVEL');mod.width=.001;mod.segments=3;obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj

for collection in ['shatranj','chaturanga']:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    output=repo/'public/assets'/collection;source=repo/'ops/assets'/collection
    output.mkdir(parents=True,exist_ok=True);source.mkdir(parents=True,exist_ok=True)
    light=material('Cream stonepaste' if collection=='shatranj' else 'Sandalwood tone',(.81,.72,.51) if collection=='shatranj' else (.72,.46,.20),.28 if collection=='shatranj' else .43)
    dark=material('Deep turquoise glaze' if collection=='shatranj' else 'Rosewood tone',(.018,.13,.14) if collection=='shatranj' else (.095,.025,.018),.26 if collection=='shatranj' else .4)
    trim=material('Brass inlay',(.51,.31,.10),.35,.72);felt=material('Felt sole',(.024,.045,.035),.96)
    roots=[]
    names=['shah','ferz','alfil','horse','rukh','pawn'] if collection=='shatranj' else ['raja','minister','elephant','horse','chariot','infantry']
    for side,y,mat in [('light',-.032,light),('dark',.032,dark)]:
        for i,name in enumerate(names):
            root=bpy.data.objects.new(f'{side}_{name}',None);bpy.context.collection.objects.link(root);roots.append(root)
            if collection=='shatranj':
                radius=.015 if i<2 else .013
                lathe('Low ceramic foot',[(radius*.9,0),(radius,.0015),(radius,.004),(radius*.9,.006)],mat,root)
                if i in [0,1]:
                    height=.049 if i==0 else .035; width=.026 if i==0 else .022
                    box('Throne seat',(0,0,.015),(width,.025,.020),mat,root,.004)
                    box('Throne back',(0,-.008,height*.60),(width,.008,height*.8),mat,root,.004)
                    for x in [-1,1]:box('Throne arm',(x*width*.40,.003,.024),(width*.23,.021,.011),mat,root,.002)
                elif i==2:
                    lathe('Alfil rounded body',[(.011,.005),(.013,.009),(.012,.025),(.009,.032),(.0001,.034)],mat,root)
                    for x in [-.0055,.0055]:
                        tusk=ball('Alfil tusk',(x,.007,.035),(.003,.004,.009),mat,root);tusk.rotation_euler.x=-.4
                elif i==3:
                    lathe('Horse rounded body',[(.011,.005),(.012,.010),(.009,.029),(.002,.034)],mat,root)
                    silhouette('Abstract horse head',[(-.004,.025),(.013,.029),(.014,.035),(.002,.041),(-.006,.034)],.013,mat,root)
                elif i==4:
                    box('Rukh body',(0,0,.016),(.026,.023,.025),mat,root,.003)
                    # Two elevated shoulders leave a real open wedge in the crown.
                    for x in [-1,1]:
                        peak=box('Rukh wedge shoulder',(x*.009,0,.032),(.009,.020,.016),mat,root,.0015);peak.rotation_euler.y=-x*.25
                else:
                    lathe('Faceted pawn dome',[(.011,.004),(.013,.008),(.010,.016),(.004,.021),(.0001,.021)],mat,root,12)
                    ball('Pawn knob',(0,0,.023),(.003,.003,.003),mat,root)
            else:
                radius=.015 if i<2 else .014 if i<5 else .0115
                lathe('Carved pedestal',[(radius*.94,0),(radius,.002),(radius,.004),(radius*.88,.006),(radius*.8,.007)],mat,root)
                lathe('Brass inlay',[(radius,.0025),(radius*1.002,.003),(radius,.0035)],trim,root)
                if i in [0,1]:
                    height=.052 if i==0 else .041
                    lathe('Royal pavilion',[(.011,.006),(.010,.011),(.006,.016),(.006,height-.014),(.010,height-.011),(.013 if i==0 else .010,height-.009),(.010,height-.007),(.004,height-.002),(.0001,height)],mat,root)
                    if i==0:
                        for x in [-.005,.005]:box('Pavilion column',(x,0,.030),(.002,.006,.018),trim,root,.0005)
                    else:ball('Minister finial',(0,0,height+.002),(.003,.003,.004),mat,root)
                elif i==2:
                    for x in [-.006,.006]:
                        for yy in [-.008,.008]:box('Elephant leg',(x,yy,.012),(.006,.007,.013),mat,root,.002)
                    ball('Elephant body',(0,-.003,.023),(.011,.016,.011),mat,root)
                    ball('Elephant head',(0,.012,.029),(.009,.008,.009),mat,root)
                    for x in [-.009,.009]:ball('Elephant ear',(x,.008,.029),(.004,.007,.008),mat,root)
                    silhouette('Elephant trunk',[(.016,.031),(.022,.029),(.023,.017),(.018,.013),(.014,.015),(.018,.019),(.018,.026)],.005,mat,root)
                    for x in [-.005,.005]:ball('Elephant tusk',(x,.019,.025),(.0015,.006,.0015),trim,root)
                    box('Elephant saddle',(0,-.004,.033),(.017,.018,.004),trim,root,.001)
                elif i==3:
                    silhouette('Horse head',[(-.009,.007),(.006,.007),(.006,.023),(.016,.028),(.016,.035),(.005,.041),(.003,.049),(-.003,.043),(-.010,.033)],.010,mat,root)
                    for x in [-.0055,.0055]:ball('Horse eye',(x,.006,.037),(.001,.001,.001),trim,root)
                elif i==4:
                    box('Chariot platform',(0,0,.016),(.022,.029,.009),mat,root,.0015)
                    for x in [-.012,.012]:
                        for yy in [-.008,.008]:
                            wheel=lathe('Chariot wheel',[(.007,0),(.007,.003)],mat,root,20);wheel.rotation_euler.y=math.pi/2;wheel.location=(x,yy,.014)
                    for x in [-.008,.008]:box('Chariot upright',(x,-.009,.027),(.003,.003,.025),mat,root,.0007)
                    box('Chariot canopy',(0,-.007,.040),(.025,.017,.004),mat,root,.001)
                else:
                    lathe('Infantry body',[(.008,.006),(.007,.010),(.004,.020),(.006,.023)],mat,root)
                    ball('Infantry helmet',(0,0,.027),(.007,.007,.007),mat,root)
                    box('Helmet ridge',(0,0,.033),(.002,.010,.003),trim,root,.0006)
            lathe('Felt sole',[(.010,.0001),(.010,.0005)],felt,root)
            root.location=((i-2.5)*.052,y,0)
    plinth=material('Studio plinth',(.075,.06,.045),.5)
    box('Delivery plinth',(0,0,-.008),(.34,.145,.016),plinth,None,.004)
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=780;scene.render.resolution_percentage=100
    scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
    if not scene.world:scene.world=bpy.data.worlds.new('Gallery ambient')
    scene.world.color=(.18,.18,.18)
    bpy.ops.object.camera_add(location=(.19,-.36,.24));camera=bpy.context.object;camera.name='Delivery camera';camera.data.type='ORTHO';camera.data.ortho_scale=.40
    camera.rotation_euler=(Vector((0,0,.018))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    for name,pos,power,size in [('Key',(-.22,-.25,.4),10,.18),('Fill',(.3,-.03,.24),6,.16),('Rim',(0,.2,.32),9,.12)]:
        bpy.ops.object.light_add(type='POINT',location=pos);obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.shadow_soft_size=size
    scene.view_settings.view_transform='Khronos PBR Neutral'
    bpy.ops.wm.save_as_mainfile(filepath=str(source/'collection.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for child in root.children:child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    scene.render.filepath=str(output/'collection.png');bpy.ops.render.render(write_still=True)
