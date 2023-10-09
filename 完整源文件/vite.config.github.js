import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'

const input = {
    main: resolve(__dirname, 'index.html')
}
const samples = readdirSync(resolve(__dirname, 'samples'))
for(let file of samples){
    if(file.endsWith('.html'))
        input[file.slice(0, -5)] = resolve(__dirname, 'samples/'+ file)
}
export default defineConfig({
    base: '/orillusion-webgpu-samples/',
    build: {
        rollupOptions: {
            input
        }
    }
})

// 这段代码是一个使用 Vite 构建工具的配置文件，它定义了项目的构建选项和输入文件。

// 以下是对代码的分析：

// 1. `const { defineConfig } = require('vite')`：引入 `vite` 模块中的 `defineConfig` 函数，用于创建 Vite 配置对象。

// 2. `const { resolve } = require('path')`：引入 Node.js 中的 `path` 模块的 `resolve` 函数，用于解析文件路径。

// 3. `const fs = require('fs')`：引入 Node.js 中的 `fs` 模块，用于文件系统操作。

// 4. `const input = { ... }`：定义一个名为 `input` 的对象，用于存储输入文件的路径。`main` 键对应的值是 `index.html` 文件的路径。

// 5. `const samples = fs.readdirSync(resolve(__dirname, 'samples'))`：读取 `samples` 目录下的文件列表，并将其存储在 `samples` 变量中。

// 6. `for(let file of samples) { ... }`：遍历 `samples` 变量中的每个文件。

// 7. `if(file.endsWith('.html')) input[file.slice(0, -5)] = resolve(__dirname, 'samples/'+ file)`：如果文件以 `.html` 结尾，则将文件名（去除后缀）作为键，将文件的完整路径作为值，添加到 `input` 对象中。这将为每个 `.html` 文件创建一个入口点。

// 8. `module.exports = defineConfig({ ... })`：导出一个调用 `defineConfig` 函数的配置对象，作为 Vite 的配置。

// 9. `base: '/orillusion-webgpu-samples/'`：指定构建后文件的基本 URL 路径。

// 10. `build: { rollupOptions: { input } }`：定义构建选项的 `rollupOptions`，其中的 `input` 键指定输入文件。

// 总结：该配置文件使用 Vite 构建工具配置了输入文件和构建选项。它通过读取 `samples` 目录下的 `.html` 文件，为每个文件创建一个入口点，将其作为输入文件进行构建。最终构建的文件将以指定的基本 URL 路径部署。