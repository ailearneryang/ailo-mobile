import React,{useMemo} from 'react';
import {View,Text,ScrollView,StyleSheet,Platform,Linking} from 'react-native';
import {markdownTree,MarkdownNode,webLink} from './markdown';
export default function MarkdownContent({content}:{content:string}){
 const nodes=useMemo(()=>markdownTree(content),[content]);
 function inline(items:MarkdownNode[]):React.ReactNode{return items.map((n,i)=>{
  if(n.type==='text')return n.content;
  if(n.type==='softbreak'||n.type==='hardbreak')return '\n';
  if(n.type==='image')return <Text key={i} style={s.caption}>〔图片：{n.content||'附件'}〕</Text>;
  if(n.type==='code_inline')return <Text key={i} style={s.inlineCode}>{n.content}</Text>;
  const href=n.type==='link_open'?webLink(n.attrs.href):null;
  return <Text key={i} style={n.type==='strong_open'?s.strong:n.type==='em_open'?s.em:n.type==='s_open'?s.strike:href?s.link:undefined} onPress={href?()=>{void Linking.openURL(href).catch(()=>{});}:undefined}>{n.children.length?inline(n.children):n.content}</Text>;
 });}
 function blocks(items:MarkdownNode[],depth=0):React.ReactNode{return items.map((n,i)=>{
  const key=i;
  if(n.type==='inline')return <Text key={key} selectable style={s.body}>{inline(n.children)}</Text>;
  if(n.type==='paragraph_open')return <Text key={key} selectable style={s.paragraph}>{n.children.map((c,j)=><React.Fragment key={j}>{c.type==='inline'?inline(c.children):c.content}</React.Fragment>)}</Text>;
  if(n.type==='heading_open')return <Text key={key} selectable accessibilityRole="header" style={[s.heading,n.tag==='h1'?s.h1:n.tag==='h2'?s.h2:s.h3]}>{n.children.map((c,j)=><React.Fragment key={j}>{inline(c.children)}</React.Fragment>)}</Text>;
  if(n.type==='bullet_list_open'||n.type==='ordered_list_open')return <View key={key} style={s.list}>{n.children.map((c,j)=><View key={j} style={s.listRow}><Text style={s.marker}>{n.type==='ordered_list_open'?String(Number(n.attrs.start||1)+j)+'.':'•'}</Text><View style={s.listText}>{blocks(c.children,depth+1)}</View></View>)}</View>;
  if(n.type==='blockquote_open')return <View key={key} style={s.quote}>{blocks(n.children,depth+1)}</View>;
  if(n.type==='fence'||n.type==='code_block')return <View key={key} style={s.codeBox}><Text style={s.codeLabel}>{n.info.trim().split(/\s/)[0]||'代码'}</Text><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled><Text selectable style={s.code}>{n.content.replace(/\n$/,'')}</Text></ScrollView></View>;
  if(n.type==='hr')return <View key={key} style={s.rule}/>;
  if(n.type==='table_open'){
   const rows=n.children.flatMap(section=>section.children).filter(row=>row.type==='tr_open');
   const columns=Math.max(1,...rows.map(r=>r.children.length));
   return <ScrollView key={key} horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={s.tableScroll}><View style={s.table}>{rows.map((row,r)=><View key={r} style={[s.tableRow,r===0&&s.tableHeader]}>{row.children.map((cell,c)=><View key={c} style={[s.cell,{width:columns===2?156:168}]}><Text selectable style={[s.cellText,cell.tag==='th'&&s.strong]}>{cell.children.map((x,j)=><React.Fragment key={j}>{inline(x.children)}</React.Fragment>)}</Text></View>)}</View>)}</View></ScrollView>;
  }
  return n.children.length?<View key={key}>{blocks(n.children,depth)}</View>:n.content?<Text key={key} selectable style={s.paragraph}>{n.content}</Text>:null;
 });}
 return <View style={s.root}>{blocks(nodes)}</View>;
}
const mono=Platform.OS==='ios'?'Menlo':'monospace';
const s=StyleSheet.create({
 root:{alignSelf:'stretch',minWidth:0},body:{fontSize:15,lineHeight:25,color:'#282b31'},paragraph:{fontSize:15,lineHeight:25,color:'#282b31',marginTop:2,marginBottom:10},
 heading:{fontWeight:'600',color:'#171a20',marginTop:16,marginBottom:9},h1:{fontSize:22,lineHeight:31},h2:{fontSize:20,lineHeight:29},h3:{fontSize:17,lineHeight:26},strong:{fontWeight:'700',color:'#171a20'},em:{fontStyle:'italic'},strike:{textDecorationLine:'line-through'},link:{color:'#3165fa',textDecorationLine:'underline'},caption:{color:'#858b95',fontSize:13},
 inlineCode:{fontFamily:mono,fontSize:13,backgroundColor:'#eff1f5',color:'#475269'},list:{gap:2,marginBottom:8},listRow:{flexDirection:'row',alignItems:'flex-start',gap:8},marker:{fontSize:15,lineHeight:25,color:'#666d78',minWidth:18,textAlign:'right'},listText:{flex:1,minWidth:0},quote:{borderLeftWidth:3,borderColor:'#b9c9f7',backgroundColor:'#f5f7fc',paddingHorizontal:13,paddingVertical:8,borderRadius:5,marginVertical:8},
 codeBox:{backgroundColor:'#f4f5f7',borderWidth:1,borderColor:'#e9ebef',borderRadius:12,padding:13,marginVertical:9},codeLabel:{fontSize:10,color:'#9198a3',marginBottom:9},code:{fontFamily:mono,fontSize:12,lineHeight:21,color:'#343d4c',paddingBottom:4},rule:{height:1,backgroundColor:'#e9ecf1',marginVertical:14},
 tableScroll:{marginVertical:10},table:{borderWidth:1,borderColor:'#e5e8ee',borderRadius:9,overflow:'hidden'},tableRow:{flexDirection:'row',borderBottomWidth:1,borderColor:'#e9ecf1'},tableHeader:{backgroundColor:'#f4f6fa'},cell:{padding:11,borderRightWidth:1,borderColor:'#e9ecf1'},cellText:{fontSize:13,lineHeight:21,color:'#343b47'}
});
