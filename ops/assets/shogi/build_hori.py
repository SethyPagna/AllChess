"""Carved/Hori: original contemporary single-character honey-boxwood Shogi.

Blender 5.2: blender -b -t 4 --python ops/assets/shogi/build_hori.py
Use -- --prototype for a scratch king/pawn carving proof, or --reuse-bakes
only when material source is unchanged. Noto Serif CJK JP Bold is OFL-1.1;
see FONT-LICENSE.txt and hori-model.md. No artisan's design is reproduced.
"""
import bpy, bmesh, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/atelier/hori';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(OUT/'vendor'))
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from shapely import Polygon, union_all, constrained_delaunay_triangles
from shapely.geometry.polygon import orient
PROTOTYPE='--prototype' in sys.argv
STAGED='--stage' in sys.argv
FONT_PATH=ROOT/'output/playwright/shogi-font/NotoSerifCJKjp-Bold.otf'
assert hashlib.sha256(FONT_PATH.read_bytes()).hexdigest()=='861a2b2c0e24b23745c262be8c3fdef63f12628f0492fb120ee51aa55c503af8'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='CYCLES'
scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True;scene.render.bake.margin=8
scene.view_settings.view_transform='Khronos PBR Neutral'
font=bpy.data.fonts.load(str(FONT_PATH))
font.use_fake_user=True
font_source=TTFont(str(FONT_PATH));font_glyphs=font_source.getGlyphSet()


class OutlinePen(BasePen):
 """Flatten licensed outlines, then union dilated strokes before extrusion."""
 def __init__(self):super().__init__(font_glyphs);self.contours=[];self.points=[]
 def _moveTo(self,p):self.points=[p]
 def _lineTo(self,p):self.points.append(p)
 def _curveToOne(self,a,b,c):
  def flatten(p,a,b,c,depth=0):
   # Preserve exact endpoints/corners; sub-font-unit curve deviation.
   chord=Vector(c)-Vector(p);den=max(chord.length,1e-9)
   cross=lambda q:abs(chord.x*(q[1]-p[1])-chord.y*(q[0]-p[0]))/den
   if depth>=12 or max(cross(a),cross(b))<.7:self.points.append(c);return
   mid=lambda x,y:((x[0]+y[0])/2,(x[1]+y[1])/2)
   pa,ab,bc=mid(p,a),mid(a,b),mid(b,c);pab,abc=mid(pa,ab),mid(ab,bc);center=mid(pab,abc)
   flatten(p,pa,pab,center,depth+1);flatten(center,abc,bc,c,depth+1)
  flatten(self.points[-1],a,b,c)
 def _closePath(self):
  if len(self.points)>2:self.contours.append(self.points)
  self.points=[]
 def _endPath(self):self._closePath()


def material(name,color,roughness):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness
 return m


def wood_material(name,endgrain=False):
 """Two original grain cuts; bake portable maps, retain procedural source nodes."""
 m=material(name,(.4928,.2992,.1144),.43);n=m.node_tree.nodes;l=m.node_tree.links
 p=n.get('Principled BSDF');out=n.get('Material Output')
 p.inputs['Coat Weight'].default_value=.10;p.inputs['Coat Roughness'].default_value=.35
 uv=n.new('ShaderNodeTexCoord')
 scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
 scale.inputs[1].default_value=(1,1,1) if endgrain else (18,.7,1);l.new(uv.outputs['UV'],scale.inputs[0])
 fine=n.new('ShaderNodeTexNoise');fine.name='Original fine boxwood fibres'
 fine.inputs['Scale'].default_value=9 if not endgrain else 85;fine.inputs['Detail'].default_value=2;fine.inputs['Roughness'].default_value=.65;l.new(scale.outputs[0],fine.inputs['Vector'])
 broad=n.new('ShaderNodeTexNoise');broad.name='Restrained honey figuring'
 broad.inputs['Scale'].default_value=2.3 if not endgrain else 3.5;broad.inputs['Detail'].default_value=2;l.new(scale.outputs[0],broad.inputs['Vector'])
 mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.22
 l.new(fine.outputs['Fac'],mix.inputs[1]);l.new(broad.outputs['Fac'],mix.inputs[2])
 if endgrain:
  rings=n.new('ShaderNodeTexWave');rings.name='Growth rings at the cut ends';rings.wave_type='RINGS';rings.rings_direction='Z'
  rings.inputs['Scale'].default_value=16;rings.inputs['Distortion'].default_value=2.2;rings.inputs['Detail Scale'].default_value=1.4;l.new(uv.outputs['UV'],rings.inputs['Vector'])
  ringmix=n.new('ShaderNodeMixRGB');ringmix.blend_type='MIX';ringmix.inputs[0].default_value=.17;l.new(mix.outputs[0],ringmix.inputs[1]);l.new(rings.outputs['Color'],ringmix.inputs[2]);signal=ringmix.outputs[0]
 else:signal=mix.outputs[0]
 color=n.new('ShaderNodeValToRGB');color.name='Original honey boxwood pigments'
 # Richer boxwood separates the small wedges from the pale kaya board.
 # The linear pigments are 12% darker; fibre relief and finish are unchanged.
 color.color_ramp.elements[0].position=.16;color.color_ramp.elements[0].color=(.3872,.2068,.0616,1)
 color.color_ramp.elements[1].position=.84;color.color_ramp.elements[1].color=(.5984,.3872,.1672,1);l.new(signal,color.inputs[0])
 rough=n.new('ShaderNodeMapRange');rough.name='Hand polished satin roughness';rough.inputs['To Min'].default_value=.38;rough.inputs['To Max'].default_value=.48;l.new(fine.outputs['Fac'],rough.inputs[0])
 bump=n.new('ShaderNodeBump');bump.name='Microscopic wood fibres';bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.0001;l.new(fine.outputs['Fac'],bump.inputs['Height'])
 l.new(color.outputs[0],p.inputs['Base Color']);l.new(rough.outputs[0],p.inputs['Roughness']);l.new(bump.outputs[0],p.inputs['Normal'])
 # Bake bump at the physical scale used by the final UV projection. A metre-
 # scale helper makes polished microscopic fibres round to flat 8-bit normals.
 bpy.ops.mesh.primitive_plane_add(size=1);plane=bpy.context.object
 plane.scale=(.040,.012 if endgrain else .048,1)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 plane.data.materials.append(m)
 target=n.new('ShaderNodeTexImage');n.active=target;images={}
 for key,source,size in [('colour',color.outputs[0],1024),('roughness',rough.outputs[0],512),('normal',None,512)]:
  file=OUT/(name.replace(' ','-')+'-'+key+('.jpg' if key=='colour' else '.png'))
  if '--reuse-bakes' in sys.argv and file.exists() and not ('--refresh-colour' in sys.argv and key=='colour'):
   im=bpy.data.images.load(str(file));im.colorspace_settings.name='sRGB' if key=='colour' else 'Non-Color';im.pack();images[key]=im;continue
  im=bpy.data.images.new(name+' '+key,width=size,height=size,alpha=False)
  if key!='colour':im.colorspace_settings.name='Non-Color'
  target.image=im;n.active=target
  if source:
   emit=n.new('ShaderNodeEmission');l.new(source,emit.inputs[0]);l.new(emit.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='EMIT');n.remove(emit)
  else:l.new(p.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='NORMAL')
  im.filepath_raw=str(file);im.file_format='JPEG' if key=='colour' else 'PNG';im.save();im.pack();images[key]=im
 bpy.data.objects.remove(plane,do_unlink=True);n.remove(target);l.new(p.outputs[0],out.inputs['Surface'])
 for key,input_name in [('colour','Base Color'),('roughness','Roughness')]:
  tex=n.new('ShaderNodeTexImage');tex.name='Portable '+key;tex.image=images[key];l.new(tex.outputs[0],p.inputs[input_name])
 tex=n.new('ShaderNodeTexImage');tex.name='Portable normal';tex.image=images['normal']
 normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7;l.new(tex.outputs[0],normal.inputs['Color']);l.new(normal.outputs[0],p.inputs['Normal'])
 return m


wood=wood_material('Hori honey boxwood')
endwood=wood_material('Hori cut endgrain',True)
black=material('Hori sumi ink in carved recess',(.006,.004,.0025),.63)
red=material('Hori vermilion ink in carved recess',(.38,.015,.006),.58)
for m in [black,red]:m.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.24

# Preserve the maker's size hierarchy while fitting this app's larger board.
# Length, width and thickness are deliberately independent presentation choices.
ROLES=[('king','玉',.033,.039,.0113),('rook','飛',.032,.0378,.0108),
 ('bishop','角',.032,.0378,.0108),('gold','金',.0308,.0365,.0104),
 ('silver','銀',.0308,.0365,.0104),('knight','桂',.0295,.0353,.0099),
 ('lance','香',.0272,.0347,.0095),('pawn','歩',.0265,.0334,.0092)]
PROMOTED={'rook':'竜','bishop':'馬','silver':'全','knight':'圭','lance':'杏','pawn':'と'}
DEPTH=.00042
roots=[];piece_cache={};glyph_cache={};audit={}


def activate(ob):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob


def glyph_template(char,width,length):
 key=(char,width,length)
 if key in glyph_cache:return glyph_cache[key]
 curve=bpy.data.curves.new('Editable licensed Noto source '+char,'FONT');curve.body=char;curve.font=font;curve.size=1;curve.use_fake_user=True
 print('CARVING',char,flush=True)
 pen=OutlinePen();font_glyphs[font_source.getBestCmap()[ord(char)]].draw(pen)
 signed=lambda ring:sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1]))/2
 exterior_sign=1 if signed(max(pen.contours,key=lambda p:abs(signed(p))))>0 else -1
 # CFF paths can revisit the same point at serif joins. A zero-width union
 # resolves those self touches before the deliberate silhouette expansion.
 outer=[Polygon(p).buffer(0) for p in pen.contours if signed(p)*exterior_sign>0]
 holes=[Polygon(p).buffer(0) for p in pen.contours if signed(p)*exterior_sign<0]
 shape=union_all(outer).difference(union_all(holes)).buffer(12,join_style='mitre',mitre_limit=2)
 if not shape.is_valid or shape.is_empty:raise RuntimeError('Invalid broadened outline: '+char)
 x0,y0,x1,y1=shape.bounds;factor=min(width*.74/(x1-x0),length*.63/(y1-y0))
 verts=[];faces=[];indices={}
 def index(x,y,z):
  key=(round(x,7),round(y,7),z)
  if key not in indices:
   indices[key]=len(verts);verts.append(((x-(x0+x1)/2)*factor,(y-(y0+y1)/2)*factor-length*.075,z))
  return indices[key]
 polygons=[shape] if shape.geom_type=='Polygon' else list(shape.geoms)
 for polygon in polygons:
  polygon=orient(polygon,sign=1)
  for triangle in constrained_delaunay_triangles(polygon).geoms:
   points=list(orient(triangle,sign=1).exterior.coords)[:-1]
   faces.append(tuple(index(x,y,1) for x,y in points));faces.append(tuple(index(x,y,0) for x,y in reversed(points)))
  for ring in [polygon.exterior,*polygon.interiors]:
   points=list(ring.coords)
   for (x,y),(xx,yy) in zip(points,points[1:]):faces.append((index(x,y,0),index(xx,yy,0),index(xx,yy,1),index(x,y,1)))
 data=bpy.data.meshes.new('Unified licensed Noto outline '+char);data.from_pydata(verts,[],faces);data.update()
 data.validate(verbose=True);glyph_cache[key]=data;data.use_fake_user=True
 return data


def wedge(name,width,length,thickness):
 outline=[(-width/2,-length/2),(width/2,-length/2),(width*.414,length*.295),(0,length/2),(-width*.414,length*.295)]
 slope=.085
 # The bottom is a contact plane; the front face gently falls toward the tip.
 top=lambda y:thickness-slope*(y+length/2)
 verts=[(x,y,0) for x,y in outline]+[(x,y,top(y)) for x,y in outline]
 faces=[tuple(reversed(range(5))),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 data.materials.append(wood);data.materials.append(endwood)
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);activate(ob)
 bevel=ob.modifiers.new('Fine hand softened blank edges','BEVEL');bevel.width=.00022;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name)
 return ob,top


def mapped_glyph(char,width,length,top,under,bottom,upper,name):
 data=glyph_template(char,width,length).copy();ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
 for v in data.vertices:
  t=v.co.z
  if under:v.co.x=-v.co.x;v.co.z=bottom+(upper-bottom)*t
  else:v.co.z=top(v.co.y)+bottom+(upper-bottom)*t
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 data.update();return ob


def carve(body,char,width,length,top,under,ink):
 # A genuine blind recess: wood walls and floor survive below its lip.
 cutter=mapped_glyph(char,width,length,top,under,-.0005 if under else -DEPTH,DEPTH if under else .0005,'Carving tool '+char)
 activate(body);mod=body.modifiers.new(('Reverse' if under else 'Front')+' recessed '+char,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.use_self=True;mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 paint=mapped_glyph(char,width,length,top,under,DEPTH-.000032 if under else -DEPTH+.000008,DEPTH-.000008 if under else -DEPTH+.000032,('Reverse' if under else 'Front')+' ink '+char)
 paint.data.materials.append(ink)
 return paint


def finish_body(ob,width,length):
 activate(ob)
 bevel=ob.modifiers.new('Cut lip catches the light','BEVEL');bevel.width=.000055;bevel.segments=2;bevel.limit_method='ANGLE';bevel.angle_limit=.5
 bpy.ops.object.modifier_apply(modifier=bevel.name)
 data=ob.data;data.update()
 # Booleans can inherit a cutter's UV layer. Use the actual wood projection.
 for old in list(data.uv_layers):data.uv_layers.remove(old)
 uv=data.uv_layers.new(name='Grain cut UV');data.uv_layers.active=uv;uv.active_render=True
 for poly in data.polygons:
  # Exposed end faces receive their own cut grain; face and side fibres run long.
  end=abs(poly.normal.y)>.65 and abs(poly.normal.z)<.55
  poly.material_index=1 if end else 0;poly.use_smooth=False
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co
   uv.data[li].uv=(v.x/.040+.5,v.z/.012) if end else (v.x/.040+.5,v.y/.048+.5) if abs(poly.normal.z)>.4 else (v.z/.012,v.y/.048+.5)
 return ob


def uv_paint(ob):
 data=ob.data;uv=data.uv_layers.new(name='Lacquer UV')
 for poly in data.polygons:
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.04+.5,v.y/.05+.5)


def piece(side,index,role,char,width,length,thickness,promoted=False):
 front=PROMOTED[role] if promoted else '王' if role=='king' and side=='dark' else char
 reverse=char if promoted else PROMOTED.get(role)
 semantic=('promoted_' if promoted else '')+role
 root=bpy.data.objects.new(side+'_'+semantic,None);scene.collection.objects.link(root);roots.append(root)
 root['collection']='hori';root['frontGlyph']=front
 if reverse:root['reverseGlyph']=reverse
 key=(front,reverse,width,length,thickness)
 if key not in piece_cache:
  body,top=wedge('Carved boxwood '+front,width,length,thickness)
  children=[body,carve(body,front,width,length,top,False,red if promoted else black)]
  if reverse:children.append(carve(body,reverse,width,length,top,True,black if promoted else red))
  finish_body(body,width,length)
  for paint in children[1:]:uv_paint(paint)
  piece_cache[key]=children
 else:
  children=[]
  for original in piece_cache[key]:
   duplicate=original.copy();duplicate.data=original.data;scene.collection.objects.link(duplicate);children.append(duplicate)
 for child in children:child.parent=root
 root.location=((index-3.5)*.043,(.07 if side=='dark' else -.03)+(.042 if promoted else 0),0)
 return root


if PROTOTYPE:
 piece('light',3,*ROLES[0]);piece('light',4,*ROLES[-1]);piece('light',5,*ROLES[-1],True)
 for i,root in enumerate(roots):root.location=((i-1)*.045,0,0)
else:
 for side in ['light','dark']:
  for index,values in enumerate(ROLES):
   piece(side,index,*values)
   if values[0] in PROMOTED:piece(side,index,*values,True)

# Resolve copied children's parent transforms before reading local bounds.
bpy.context.view_layer.update()
for root in roots:
 vertices=[];tris=0
 for ob in root.children:
  ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
  vertices += [ob.matrix_local@v.co for v in ob.data.vertices]
 mn=[min(v[i] for v in vertices) for i in range(3)];mx=[max(v[i] for v in vertices) for i in range(3)]
 audit[root.name]={'triangles':tris,'min':mn,'max':mx,'height':mx[2]-mn[2]}
 if mx[2]>.0115 or mn[2]<-.00001:raise RuntimeError(root.name+' violates stack/contact envelope '+str((mn,mx)))
 if tris>25000:raise RuntimeError(root.name+' exceeds triangle budget')
(OUT/('prototype-audit.json' if PROTOTYPE else 'geometry-audit.json')).write_text(json.dumps(audit,indent=2))
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
 root.select_set(True)
 for child in root.children:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/('prototype.glb' if PROTOTYPE else 'staged-hori.glb') if PROTOTYPE or STAGED else ROOT/'public/assets/shogi/hori.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO',export_yup=True,export_extras=True)

scene.world=bpy.data.worlds.new('Hori studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.85,.90,1,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.12
for name,pos,power,size,color in [('Key',(-.18,-.20,.30),1.8,.14,(1,.95,.84)),('Fill',(.20,-.02,.18),.5,.16,(.84,.93,1)),('Rim',(.04,.23,.27),1.2,.13,(1,.98,.91))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,.02,.005))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Carved collection review camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=.155 if PROTOTYPE else .40
camera.location=(.03,-.21,.31) if PROTOTYPE else (.08,-.33,.51);camera.rotation_euler=(Vector((0,0 if PROTOTYPE else .04,.005))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1400;scene.render.resolution_y=850;scene.render.resolution_percentage=100
bpy.ops.file.pack_all()
scene.render.filepath=str(OUT/('prototype-preview.png' if PROTOTYPE else 'staged-hori-preview.png') if PROTOTYPE or STAGED else ROOT/'ops/assets/shogi/hori-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('prototype.blend' if PROTOTYPE else 'staged-hori.blend') if PROTOTYPE or STAGED else ROOT/'ops/assets/shogi/hori.blend'))
bpy.ops.render.render(write_still=True)
if PROTOTYPE:
 scene.render.resolution_x=185;scene.render.resolution_y=112
 scene.render.filepath=str(OUT/'prototype-playing-size.png');bpy.ops.render.render(write_still=True)
print('HORI_COMPLETE',json.dumps(audit))
