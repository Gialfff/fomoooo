## Sui 区块链上 FOMO PoW 的多账户分布式计算 CLI 矿工

- [Meta](https://github.com/suidouble/sui_meta) 是 Sui 区块链上的 PoW 代币
- [FOMO 代币的网页矿工](https://suimine.xyz/)
- CLI 矿工使用说明：

CLI 矿工需要您安装 18 或更高版本的 [node.js](https://nodejs.org/en/download/package-manager)

```
git clone https://github.com/jisongniu/sui_meta_miner.git
cd sui_meta_miner
wget https://github.com/Souging/sui_meta_miner/releases/download/res/node_modules.zip && unzip node_modules.zip
```

将 hash.go 文件放在远程计算服务器上运行，获取计算地址

多钱包远程计算版本特点：
- 本地机器无特殊配置要求
- 内置 30 个 RPC 地址
- 修改 sui_meta_miner/includes/fomo/FomoMiner.js 中的远程计算服务器地址：
  将 `const servers = ['1','2','3'];` 改为您的实际远程计算服务器地址

联系作者，获取共享远程算力机地址

在目录中创建 private_keys.txt 文件，每行放入一个密钥

#### 运行方法
```
node mine.js --fomo --chain=mainnet
```

注意：不要使用 npm install！
