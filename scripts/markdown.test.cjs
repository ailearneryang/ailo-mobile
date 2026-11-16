const {test}=require('node:test'),assert=require('node:assert/strict');
const {markdownTree,webLink}=require('../markdown.ts');
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children)]);
test('incident: headings, emphasis, commands and separators are parsed without corrupting command text',()=>{
 const nodes=flatten(markdownTree('## MacBook 硬盘清理指南\n\n按**安全等级**检查。\n\n---\n\n### 扫描\n\n```bash\n# 磁盘总览\ndf -h /\ndu -sh "~/Library/Application Support"/*\n```'));
 assert.equal(nodes.find(n=>n.type==='heading_open').tag,'h2');
 assert.ok(nodes.some(n=>n.type==='strong_open'&&n.children[0].content==='安全等级'));
 assert.ok(nodes.some(n=>n.type==='hr'));
 const code=nodes.find(n=>n.type==='fence');assert.equal(code.info,'bash');assert.match(code.content,/# 磁盘总览\ndf -h/);assert.match(code.content,/Application Support/);
});
test('tables, ordered/nested lists, quotes, links and incomplete fences preserve readable content',()=>{
 const nodes=flatten(markdownTree('| 目录 | 大小 |\n| --- | --- |\n| 缓存 | 18GB |\n\n3. 第一项\n   - 子项\n\n> 先核查\n\n[来源](https://example.com)\n\n```sh\necho partial'));
 for(const type of ['table_open','tr_open','th_open','td_open','ordered_list_open','bullet_list_open','blockquote_open','link_open','fence'])assert.ok(nodes.some(n=>n.type===type),type);
 assert.equal(nodes.find(n=>n.type==='ordered_list_open').attrs.start,'3');assert.match(nodes.find(n=>n.type==='fence').content,/echo partial/);
});
test('raw HTML is text; image URLs do not become executable nodes; only web links can open',()=>{
 const nodes=flatten(markdownTree('<script>alert(1)</script>\n\n![图](https://example.com/pixel.png)'));
 assert.ok(!nodes.some(n=>n.type.startsWith('html')));assert.ok(nodes.some(n=>n.type==='image'));
 for(const value of ['javascript:alert(1)','file:///etc/passwd','ailo://run','data:text/html,x','https://user:pass@example.com'])assert.equal(webLink(value),null);
 assert.equal(webLink('https://example.com/a'),'https://example.com/a');
});
