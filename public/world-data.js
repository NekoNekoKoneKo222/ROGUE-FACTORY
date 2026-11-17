"use strict";
/*
 * Public, static campaign design. The Node simulation uses exactly the same
 * immutable definitions as the browser map. Stage properties are always
 * looked up on the server; client-provided difficulty numbers are ignored.
 */
(function(root, factory) {
  const data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.RogueWorldData = data;
})(typeof window === "undefined" ? globalThis : window, function() {
  const regions = [
    {id:"rust",name:"錆びた平原",subtitle:"RUSTLANDS",tag:"第1地域",color:"#edb477",x:16,y:275,icon:"⛏"},
    {id:"steam",name:"蒸気湿原",subtitle:"STEAM MARSH",tag:"第2地域",color:"#59dece",x:385,y:95,icon:"♨"},
    {id:"storm",name:"雷鳴高地",subtitle:"THUNDER RIDGE",tag:"第3地域",color:"#b8a1ff",x:780,y:85,icon:"ϟ"}
  ];
  const stages = [
    {id:"tutorial",order:0,region:"rust",type:"tutorial",name:"はじめての工場",subtitle:"ENGINEER TRAINING",x:108,y:481,requires:[],difficulty:1,coreHp:70,enemyDamage:0,enemyIncome:0,playerScrap:180,duration:360,xp:100,credits:90,blueprint:"新人エンジニアの腕章",story:"採掘から発射まで、5種類の設備をつないで動かそう。敵は攻撃してこない訓練用施設。",rule:"訓練専用：敵の攻撃なし"},
    {id:"rust-1",order:1,region:"rust",type:"battle",name:"廃鉱の第一防衛線",subtitle:"ABANDONED MINE",x:209,y:415,requires:["tutorial"],difficulty:1,coreHp:300,enemyDamage:0.65,enemyIncome:0.8,playerScrap:45,xp:120,credits:65,blueprint:"採掘ドローンの記録",story:"廃鉱で暴走したオートマトンが稼働している。初めての実戦に挑もう。",rule:"初級：敵の火力が低い"},
    {id:"rust-2",order:2,region:"rust",type:"battle",name:"スクラップ交差点",subtitle:"SCRAP JUNCTION",x:312,y:378,requires:["rust-1"],difficulty:2,coreHp:340,enemyDamage:0.8,enemyIncome:1.0,playerScrap:52,xp:145,credits:82,blueprint:"旧式コンベアの設計図",story:"資源が豊富な輸送路。スクラップを素早く設備に変えて前進しよう。",rule:"初期スクラップ+16"},
    {id:"rust-side",order:3,region:"rust",type:"challenge",name:"埋没した採掘坑",subtitle:"OPTIONAL / MINING",x:238,y:558,requires:["rust-1"],difficulty:3,coreHp:350,enemyDamage:0.95,enemyIncome:1.0,playerScrap:22,xp:200,credits:110,blueprint:"黄金ドリルの紋章",story:"少ない資材から生産ラインを発展させる腕試し。寄り道だが貴重な設計図が眠る。",rule:"縛り：初期スクラップ22"},
    {id:"rust-3",order:4,region:"rust",type:"elite",name:"赤熱炉の防衛線",subtitle:"FURNACE FRONT",x:376,y:485,requires:["rust-2"],difficulty:3,coreHp:385,enemyDamage:1.05,enemyIncome:1.15,playerScrap:38,xp:210,credits:115,blueprint:"赤熱の炉心",story:"高火力の砲台が工場を狙う。電力と弾薬の増産が勝敗を決める。",rule:"精鋭：敵の製造速度上昇"},
    {id:"rust-boss",order:5,region:"rust",type:"boss",name:"BOSS：廃炉の番人",subtitle:"THE RUST WARDEN",x:460,y:375,requires:["rust-3"],difficulty:4,coreHp:500,enemyDamage:1.17,enemyIncome:1.25,playerScrap:43,xp:330,credits:180,blueprint:"番人の鋼鉄エンブレム",story:"大きなコアを備えた旧式戦闘工場。精密な生産ラインを構築して突破しよう。",rule:"ボス：コアHP500"},
    {id:"steam-1",order:6,region:"steam",type:"battle",name:"蒸気運河",subtitle:"STEAM CANAL",x:558,y:311,requires:["rust-boss"],difficulty:3,coreHp:390,enemyDamage:0.9,enemyIncome:1.25,playerScrap:44,xp:210,credits:120,blueprint:"運河の蒸気旗",story:"湿原に広がる蒸気産業地帯。新しい地域の敵工場は生産速度が高い。",rule:"敵のスクラップ収入増加"},
    {id:"steam-side",order:7,region:"steam",type:"challenge",name:"蒸気圧力試験所",subtitle:"OPTIONAL / PRESSURE",x:514,y:168,requires:["steam-1"],difficulty:5,coreHp:530,enemyDamage:1.1,enemyIncome:1.4,playerScrap:25,xp:290,credits:170,blueprint:"蒸気の王冠",story:"高圧の工場との危険な模擬戦。少ない資材でボス級の敵を倒せるか。",rule:"縛り：少資材 / 敵コア強化"},
    {id:"steam-2",order:8,region:"steam",type:"elite",name:"歯車の大停泊地",subtitle:"GEAR HARBOR",x:637,y:382,requires:["steam-1"],difficulty:4,coreHp:470,enemyDamage:1.1,enemyIncome:1.35,playerScrap:42,xp:260,credits:150,blueprint:"巨大歯車の徽章",story:"運河を掌握する輸送機械群。防衛設備も忘れずに建設しよう。",rule:"精鋭：敵の補給が高速"},
    {id:"steam-boss",order:9,region:"steam",type:"boss",name:"BOSS：蒸気機械獣",subtitle:"STEAM LEVIATHAN",x:727,y:304,requires:["steam-2"],difficulty:6,coreHp:590,enemyDamage:1.34,enemyIncome:1.5,playerScrap:45,xp:410,credits:240,blueprint:"機械獣の青銅コア",story:"湿原を支配する巨大機械。敵の厚い装甲に対抗して生産力を引き上げよう。",rule:"ボス：高HP / 高火力"},
    {id:"storm-1",order:10,region:"storm",type:"battle",name:"磁気砂漠",subtitle:"MAGNETIC BADLANDS",x:818,y:259,requires:["steam-boss"],difficulty:5,coreHp:460,enemyDamage:1.14,enemyIncome:1.45,playerScrap:39,xp:310,credits:180,blueprint:"磁気の破片",story:"紫電が走る荒地。発電設備と防衛を効率よく配置しよう。",rule:"敵の電力供給強化"},
    {id:"storm-side",order:11,region:"storm",type:"challenge",name:"雷鳴鉱脈",subtitle:"OPTIONAL / STORM",x:828,y:432,requires:["storm-1"],difficulty:7,coreHp:625,enemyDamage:1.4,enemyIncome:1.65,playerScrap:25,xp:450,credits:290,blueprint:"雷光ドリルの断片",story:"高耐久の異常機械が立ちはだかる。少ない初期資源をどう使う？",rule:"縛り：初期スクラップ25"},
    {id:"storm-2",order:12,region:"storm",type:"elite",name:"壊れた制御塔",subtitle:"BROKEN CONTROL",x:914,y:190,requires:["storm-1"],difficulty:6,coreHp:560,enemyDamage:1.37,enemyIncome:1.55,playerScrap:38,xp:370,credits:210,blueprint:"制御塔の設計コア",story:"失われた制御技術が稼働している。マシンガンだけでは押し切れない。",rule:"精鋭：火力・資源速度が高い"},
    {id:"storm-3",order:13,region:"storm",type:"elite",name:"天頂発電所",subtitle:"SUMMIT REACTOR",x:1000,y:284,requires:["storm-2"],difficulty:7,coreHp:620,enemyDamage:1.5,enemyIncome:1.7,playerScrap:44,xp:430,credits:245,blueprint:"天頂リアクターの紋章",story:"嵐を電力に変換する最終防衛施設。最強の砲台と研究を組み合わせろ。",rule:"精鋭：高性能AI工場"},
    {id:"storm-boss",order:14,region:"storm",type:"boss",name:"FINAL BOSS：電磁帝王",subtitle:"THUNDER SOVEREIGN",x:1030,y:130,requires:["storm-3"],difficulty:8,coreHp:780,enemyDamage:1.75,enemyIncome:1.9,playerScrap:60,xp:720,credits:500,blueprint:"電磁帝王の王冠",story:"文明を侵食する自律工場の中枢。すべての工業知識を使い、帝王を停止させよう。",rule:"最終ボス：コアHP780 / 高火力"}
  ];
  const byId = Object.fromEntries(stages.map(stage=>[stage.id,stage]));
  const tutorials = [
    {type:"belt",x:2,y:1,title:"STEP 01 / 輸送",description:"コンベアを選択し、光っているマスに設置。採掘機から鉱石を運ぼう。",hint:"下の「コンベア」を選択してマスをタップ"},
    {type:"furnace",x:3,y:1,title:"STEP 02 / 精錬",description:"コンベアの先に精錬機を設置し、鉱石を金属へ加工する。",hint:"下の「精錬機」を選択"},
    {type:"belt",x:4,y:1,title:"STEP 03 / 搬送",description:"精錬機の出口にベルトをつなごう。金属を次の工場へ運ぶ。",hint:"もう一度コンベアを選択"},
    {type:"ammo",x:5,y:1,title:"STEP 04 / 製造",description:"弾薬工場を設置。金属を消費して弾薬が生まれる。",hint:"弾薬工場を選択"},
    {type:"turret",x:6,y:1,title:"STEP 05 / 攻撃",description:"最後に機関砲を設置。弾薬を受け取ると自動的に敵を攻撃！",hint:"機関砲を選択"},
    {type:"fire",title:"STEP 06 / 実戦",description:"完成！ ベルトを通って弾薬が流れ、砲台が敵コアを壊すまで見届けよう。",hint:"弾薬が届かない場合は設備の向きを「回転」で確認"}
  ];
  return Object.freeze({regions,stages,byId,tutorials});
});
