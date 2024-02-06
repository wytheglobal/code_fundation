import { updatedDdAppCode, isUpdateListenerEnabled } from './../updateListener/index'
import { resetComponentNode } from './../VirtualTree/index'
import { callRestoredLifeTimes } from '../PageState'
import { _typeJudgement, defineProperty } from './../util'
import TreeManager from '../TreeManager/index'
import EventName from '../EventName/index'
import {
  sendData,
  isDataThread,
  setDataListener,
  loadJsFileToDataThread,
  loadJsFileToWebview,
  removeDataListeners
} from '../DataTunnel/index'
import * as Dds from '../Dds/index'
import { convertRouteToComponentAlias } from '../Plugin/index'
import * as BasicMethod from '../BasicMethod/index'
import * as ComponentAliases from '../ComponentAliases/index'
import OperationFlow from '../Operation/operationFlow'
import * as BannerMap from '../BannedMap/index'
import { wrapTapMark } from '../Event/tapMark'
import * as ReportFlow from '../ReportFlow/index'
import TemplateEngine from './templateEngine'
import CustomComponent from './CustomComponent'
import { isArray, isFunction, guid, dfsComponents, pathRelative } from '../BasicMethod/index'
import { setLazyLoadReportField } from '../ReportFlow/index'
import { saveDynamicInitialRenderingCache, saveStaticInitialRenderingCache } from '../InitialRenderingCache'
import PageState from '../PageState/state'
import {
  addPerformanceData,
  sendPerformanceData,
  registerUpdatePerformanceListenerForWebView,
  updatePerformanceStatWithNodeIdToService,
  pushOperationFlowStack,
  popOperationFlowStack
} from '../Performance'
import { hasOwnProperty, deepCopy } from './helper'
import { ComponentDef } from '../typeDeclare/componentDef'
import { VirtualDOMEvent } from '../typeDeclare/event'
import { ViewInfoEnum } from '../ViewInfo/viewInfoEnum'
import { saveView } from '../PageState/view'


let pathRelativeMap // oe
// le和ce的区别是separateInnerData
const componentRegisterLogicOptions: exparser.ComponentRegisterInnerOptions = {
  domain: '/',
  writeOnly: false,
  allowInWriteOnly: false,
  lazyRegistration: true,
  classPrefix: '',
  templateEngine: TemplateEngine,
  renderingMode: 'full',
  multipleSlots: false,
  publicProperties: true,
  reflectToAttributes: false,
  writeFieldsToNode: false,
  writeIdToDOM: false,
  separateInnerData: true,
  innerDataExclude: null,
  randomizeTagName: false,
  virtualHost: false
}
const componentRegisterViewOptions: exparser.ComponentRegisterInnerOptions = {
  domain: '/',
  writeOnly: false,
  allowInWriteOnly: false,
  lazyRegistration: true,
  classPrefix: '',
  renderingMode: 'full',
  templateEngine: TemplateEngine,
  multipleSlots: false,
  publicProperties: true,
  reflectToAttributes: false,
  writeFieldsToNode: false,
  writeIdToDOM: false,
  separateInnerData: false,
  innerDataExclude: null,
  randomizeTagName: false,
  virtualHost: false
}
let behaviorInstanceInc: number = 1
let tabCreateRequested = false
let initRenderDone = false // 标识是否已经初始化渲染
let comDefs = [] // 存储未初始化渲染时的 COMPONENT_DEF (eventType) 数据
let comTabDefs = [] // 存储未初始化渲染时的 COMPONENT_DEF_TAB (eventType) 数据

const placeholderMap = {} // 占位符，和 vTree -> expNode 有关
let placeholderUsingPathSet: Set<string> = new Set() // 占位符的引用路径 (value) 集合
const placeholderKeysSet: Set<string> = new Set() // 存放placeholder的key
const tabbarComp = 'custom-tab-bar/index'
const compSet = new Set([tabbarComp])
const placeholderComponentMap = {} // 存储placeholder相关组件
const tmplPlaceholderFuncMap: Record<string, () => void> = {} // Ue: k -> templateId，属 placeholder 的逻辑，value 是 replace 回调

let tmplPlaceholderTimer = undefined
const customCompRegisterMap: Record<string, exparser.ComponentRegisterOption> = {} // ue 存放 CustomComponent 引用的注册参数
const customCompUsingMap: Record<string, Record<string, string>> = {} // 存放 using 组件引用关系的
const customCompGenericsMap: Record<string, {
  default?: string;
}> = {} // fe 存放 CustomComponent 引用的 generics 信息
const behaviorUsingKeysMap: Record<string, string[]> = {} // 存放 behaviorKeys
const behaviorRegisterMap: Record<string, exparser.ComponentRegisterOption> = {} // he 存放 behavior 注册参数
const tempFuncs = []
let loadedCustomTabbar = false
let componentStateMap: Record<string, boolean> = Object.create(null) // 怀疑是组件是否处理完成的状态表

// se
const defaultOptions = {
  lazyRegistration: true,
  publicProperties: true
}

let componentClassPrefix = null
let classPrefixMap: Record<string, string> = null // 存储 classPrefix 的 map
let tabbarClassPrefix = null
const propertiesTypeConstructor: Record<string, exparser.PropertyType | null> = {
  String,
  Number,
  Boolean,
  Object,
  Array,
  null: null
}
let isThisFirstPage = true
// let Ze = true
// let Se
let pageLoadInfo = {
  jsFileLoaded: false,
  jsFileLoadedCallback: [],
  compDefLoaded: false,
  compDefLoadedCallback: []
}
const pageLoadInfoCallbackMap = {
  notifyJsFileLoaded() {
    pageLoadInfo.jsFileLoaded = true
    pageLoadInfo.jsFileLoadedCallback.forEach((cb) => {
      cb()
    })
    pageLoadInfo.jsFileLoadedCallback = []
  },
  onJsFileLoaded(e) {
    if (pageLoadInfo.jsFileLoaded) {
      e()
    } else {
      pageLoadInfo.jsFileLoadedCallback.push(e)
    }
  },
  notifyCompDefLoaded() {
    pageLoadInfo.compDefLoaded = true
    pageLoadInfo.compDefLoadedCallback.forEach((e) => {
      e()
    })
    pageLoadInfo.compDefLoadedCallback = []
  },
  onCompDefLoaded(e) {
    if (pageLoadInfo.compDefLoaded) {
      e()
    } else {
      pageLoadInfo.compDefLoadedCallback.push(e)
    }
  },
  clearStatus() {
    pageLoadInfo = {
      jsFileLoaded: false,
      jsFileLoadedCallback: [],
      compDefLoaded: false,
      compDefLoadedCallback: []
    }
  }
}
// let N = {}
// let operationFlowInc = 1
// let operationFlowStack: number[] = []
let mainPageFrameReadyFlag = false
const readyCallbacks = []

function registerReadyCallback(cb) {
  mainPageFrameReadyFlag ? cb() : readyCallbacks.push(cb)
}

function mainPageFrameReadyHandler() {
  if (mainPageFrameReadyFlag !== true) {
    mainPageFrameReadyFlag = true
    readyCallbacks.forEach((fn) => fn())
  }
}

// Logic
if (!isDataThread()) {
  // Webview Logic 1
  registerUpdatePerformanceListenerForWebView()

  // Webview Logic 2
  if (typeof __ddAppCode__ !== 'undefined') {
    mainPageFrameReadyHandler()
  } else {
    window['__mainPageFrameReady__'] = mainPageFrameReadyHandler
  }

  // Webview Logic 5
  registerReadyCallback(() => {
    if (__ddConfig.isFirstPage) {
      const launchPath = __ddConfig.appLaunchInfo.path.replace(/\.html$/, '').replace(/^\//, '')
      setTimeout(() => {
        lazyLoad(launchPath, null, true)
      }, 0)
    }
  })

  // Webview Logic 6
  registerReadyCallback(() => {
    lazyLoad(tabbarComp, null, __ddConfig.isFirstPage, true)
    handleWebviewJs(() => {
      sendTabBarCreationRequest()
    })
  })

  // Webview Logic 7
  setDataListener(EventName.SYNC_EVENT_NAME.DESTROY_TAB, () => {
    TreeManager.instance.tabDestroyed = true
    if (window.__TAB_BAR__) {
      window.__TAB_BAR__.parentNode.removeChild(window.__TAB_BAR__)
    }
  })
}

// Webview Logic 3 (component def lazy)
setDataListener(EventName.SYNC_EVENT_NAME.COMPONENT_DEF_LAZY, (def) => {
  if (initRenderDone) {
    handleComponentDef(def, false)
  } else {
    comDefs.push(def)
  }
  pageLoadInfoCallbackMap.onJsFileLoaded(() => {
    pageLoadInfoCallbackMap.notifyCompDefLoaded()
  })
}, 0)

// Webview Logic 4 (load component def)
setDataListener(EventName.SYNC_EVENT_NAME.LOAD_COMPONENT_DEF, (data) => {
  lazyLoad(data[0], null, false)
  // if (!__ddConfig.isFirstPage) {
  //   re = data[1]
  //   ne(data[0], null, false)
  // }
}, 0)
setDataListener(EventName.SYNC_EVENT_NAME.COMPONENT_DEF, (def) => {
  if (initRenderDone) {
    handleComponentDef(def, false)
  } else {
    comDefs.push(def)
  }
}, 0)
setDataListener(EventName.SYNC_EVENT_NAME.COMPONENT_DEF_TAB, (data) => {
  if (initRenderDone) {
    handleComponentDef(data[0], true)
  } else {
    comTabDefs.push(data[0])
  }
}, 0)
setDataListener(EventName.SYNC_EVENT_NAME.UPDATE_COMPONENT_DEF, (data) => {
  const [compRegisterOption] = data
  const viewThreadManager = TreeManager.instance
  if (exparser.Component._list[compRegisterOption.is]) {
    // 这里不考虑 tabbar
    prepareComponent(compRegisterOption, viewThreadManager.rootCompName === compRegisterOption.is)
  }
})

// Webview Logic 8
if (isDataThread()) {
  // 逻辑层
  // setDataListener(EventName.SYNC_EVENT_NAME.REQUEST_TAB, (data, eventType, viewId) => {
  //   try{
  //     __ddConfig.onReady(() => {
  //       // initViewTabbar(viewId, true)
  //     })
  //   }catch(e){

  //   }
  // }, '$GLOBAL')
} else {
  // 视图层
  setDataListener(EventName.SYNC_EVENT_NAME.FLUSH_BLOCKED, () => {
    TreeManager.instance.operationFlow.flushBlocked()
  }, 0)
}

// type PerformanceStat = {
//   isMergedUpdate,
//   dataPaths,
//   pendingStartTimestamp?,
//   updateStartTimestamp?,
//   updateEndTimestamp
// }

/**
 * 根据所有的组件路由，搜集对应的 classPrefix 并返回
 * @dmcc v1.1.9
 * @returns Record<string, string>
 */
function collectClassPrefix(compIsList: string[]): Record<string, string>
function collectClassPrefix(compRegisterOptionList: exparser.ComponentRegisterOption[]): Record<string, string>
function collectClassPrefix(list: exparser.ComponentRegisterOption[] | string[]): Record<string, string> {
  const compPrefixMap: Record<string, string> = Object.create(null)

  let is: string // 组件路由
  let prefix: string // 组件样式前缀

  for (const item of list) {
    is = (typeof item === 'string') ? item : item.is
    prefix = ''

    // 遍历每一个字符
    for (let i = 0, size = is.length, ch: string, charCode: number; i < size; ++i) {
      ch = is[i]
      charCode = ch.charCodeAt(0)
      if (
        (charCode >= 48 && charCode <= 57) || // 0 - 9
        (charCode >= 65 && charCode <= 90) || // A - Z
        (charCode >= 97 && charCode <= 122) || // a - z
        charCode === 45 || // '-'
        charCode === 95 // '_'
      ) {
        prefix += ch
      } else if (ch === '/') {
        // 此处特判 '/' 是为了向下兼容
        prefix += '-'
      } else {
        // 如为非常规字符，直接拼接 charCode
        prefix += charCode
      }
    }

    compPrefixMap[is] = prefix
  }

  return compPrefixMap
}

/**
 * 获取依赖的自定义组件
 * @param path
 * @param appCode
 */
function getUsing(path: string, appCode) {
  const using = {}
  const usingComponents = (appCode[`${path }.json`] || {}).usingComponents
  for (const key in usingComponents) {
    using[`dd-${ key}`] = BasicMethod.pathRelative(path, String(usingComponents[key]))
  }
  return using
}

/**
 * K
 * 处理 relation 的声明路径
 * @param JSFilePath
 * @param relationOptions
 */
function handleRelations<T extends exparser.RelationOptions>(JSFilePath: string, relationOptions: T): T {
  for (const relativePath in relationOptions) {
    const relation = relationOptions[relativePath]
    relation.target = null != relation.target ? String(relation.target) : BasicMethod.pathRelative(JSFilePath, String(relativePath))
  }
  return relationOptions
}


function ee(path, pageSet: Set<unknown>) {
  // __DDML_DEP__我们没有，下面逻辑现在看来走不进去
  if (typeof __DDML_DEP__ !== 'undefined') {
    const depFile = __DDML_DEP__[`./${path}.wxml`]
    isArray(depFile) && depFile.forEach((filePath) => {
      const pageName = filePath.substr(2, filePath.length - 7)
      pathRelativeMap[pageName] && pageSet.add(pageName)
    })
  }
}

function setCompRouteLoadedSet(route, e) {
  let keys, keysSet, placeholder
  const set = e.set,
    dropLazy = e.dropLazy
  if (!set.has(route)) {
    set.add(route)
    keys = pathRelativeMap ? Object.keys(pathRelativeMap[route] || {}) : []
    if (dropLazy) {
      keysSet = new Set(keys)
      placeholder = placeholderMap[route] || {}
      Object.keys(placeholder).forEach((key) => {
        keysSet.delete(key)
      })
      BasicMethod.objectValues(placeholder).forEach((value) => {
        keysSet.add(value)
      })
      keys = Array.from(keysSet)
    }
    keys.forEach((key) => {
      setCompRouteLoadedSet(pathRelativeMap[route][key], {
        set,
        dropLazy
      })
    })
  }
}

// 应该是分包加载
function loadSubpackage(rootCompName: string, set, viewId: number = null): string[] {
  let subPackages = (isDataThread() ? __ddConfig.subPackages : undefined)
  subPackages = subPackages || []
  subPackages = subPackages.filter((subPackage) => {
    return rootCompName.indexOf(subPackage.root) === 0
  })
  const root = (subPackages[0] && subPackages[0].root) || '',
    allExtendedComponents = (subPackages[0] && subPackages[0].allExtendedComponents) || [],
    route = Array.from(set).map((e) => {
      return -1 < allExtendedComponents.indexOf(e) ? root + e : e
    })
  if (isDataThread()) {
    if (!placeholderComponentMap[viewId]) {
      placeholderComponentMap[viewId] = new Set()
    }
    route.forEach((e) => {
      return placeholderComponentMap[viewId].add(e)
    })
  }
  const compList = route.filter((comp) => !componentLoaded(comp))
  compList.forEach((comp) => {
    compSet.add(comp)
  })
  return compList
}

// 懒加载,fast只有自定义tabbar为true
function lazyLoad(route: string, e, isFirst, fast: boolean = false) {
  let loadedRouteSet
  if (__ddConfig && __ddConfig.isLazyLoad) {
    const ddAppCode = typeof __ddAppCode__ !== 'undefined' ? __ddAppCode__ : {}
    if (pathRelativeMap === undefined) {
      pathRelativeMap = {}
    }
    for (const key in ddAppCode) {
      if (key.substr(key.length - 5) === '.json') {
        const path = key.slice(0, -5) // 截取 path
        const JSONContent = ddAppCode[key]
        const using = {}
        const placeholder = {}

        // Using Components
        const usingComponents = JSONContent['usingComponents']
        for (const usingKey in usingComponents) {
          using[usingKey] = pathRelative(path, usingComponents[usingKey])
        }

        // Component Generics
        const componentGenerics = JSONContent['componentGenerics']
        for (const genericKey in componentGenerics) {
          const _default = componentGenerics[genericKey]['default']
          if (_default) {
            using[String(_default)] = pathRelative(path, _default)
          }
        }

        // Component Placeholder
        const componentPlaceholder = JSONContent['componentPlaceholder']
        for (const usingKey in componentPlaceholder) {
          placeholder[usingKey] = componentPlaceholder[usingKey]
        }

        pathRelativeMap[path] = using
        placeholderMap[path] = placeholder || {}
      }
    }
    const Comps = Object.keys(pathRelativeMap)
    componentClassPrefix = collectClassPrefix(Comps)

    if (!fast) {
      // startNewLazyLoadReport()
      setLazyLoadReportField('isFirstPage', isFirst ? 1 : 0)
      setLazyLoadReportField('isWebview', isDataThread() ? 0 : 1)
      setLazyLoadReportField('totalComps', Comps.length)
    }

    /** @type {!Set} */
    loadedRouteSet = new Set()
    setCompRouteLoadedSet(route, {
      set: loadedRouteSet,
      dropLazy: true
    })
    Object.keys(placeholderMap).forEach((placeholderKey) => {
      setCompRouteLoadedSet(placeholderKey, {
        set: placeholderKeysSet
      })
    })
    loadedRouteSet.forEach((loadedRoute) => {
      return ee(loadedRoute, loadedRouteSet)
    })
    const loadedComps = loadSubpackage(route, loadedRouteSet, e)

    if (!fast) {
      ReportFlow.setLazyLoadReportField('loadedComps', loadedComps.length)
      ReportFlow.setLazyLoadReportField('lazyedComps', 0)
      ReportFlow.setLazyLoadReportField('lazyLoadTime', 0)
    }

    if (isDataThread()) {
      const appServiceFiles = loadedComps.map((comp) => `/${comp}.appservice.js`)
      loadJsFileToDataThread(appServiceFiles)
      if (!fast) {
        // ReportFlow.setLazyLoadReportField("loadTime", loadTime)
      }
    } else {
      // 我们当前懒加载组件设计并没有对component单独打包，以下逻辑并没有走
      const webviewFiles = loadedComps.map((comp) => `/${comp}.webview.js`)
      loadJsFileToWebview(webviewFiles, (loadTime) => {
        function wrapper() {
          let define
          let t
          ReportFlow.setLazyLoadReportField('loadTime', loadTime)
          if (!(undefined !== (define = ('undefined' !== typeof __ddAppCode__ ? __ddAppCode__ : {})[`${route }.ddss`]) && 'function' === typeof define)) {
            define = function() {
            }
          }
          window.__setCssStartTime__ = Date.now()
          define()
          window.__setCssEndTime__ = Date.now()
          t = ('undefined' !== typeof __ddAppCode__ ? __ddAppCode__ : {})[`./${ route }.ddml`]
          if (Array.isArray(t)) {
            t = t[0][t[1]]
          }
          if (window.__ddAppCodeReadyCallback__) {
            window.__ddAppCodeReadyCallback__(t)
          } else {
            document.dispatchEvent(new CustomEvent('generateFuncReady', {
              detail: {
                generateFunc: t
              }
            }))
          }
        }

        if (fast) {
          wt()
        } else if (isEnableTabbar()) {
          handleWebviewJs(wrapper)
        } else {
          wrapper()
        }
      })
    }
  }
}

// Ae
export function setModelValueData(data: any, modelValueName: string, viewId: number, nodeId: string) {
  const exparserComp = TreeManager.get(viewId).nodeId.getNodeById(nodeId)
  if (exparserComp && modelValueName) {
    const _data = defineProperty({}, modelValueName, data)
    exparser.Element.getMethodCaller(exparserComp).setData(_data)
  }
}

// be
export function getLazyCompPlaceholder(tag: string): Record<string, string> {
  if (!placeholderMap[tag]) return {}
  const placeholder = {}
  Object.keys(placeholderMap[tag]).forEach((key) => {
    placeholder[`dd-${ key}`] = `dd-${ placeholderMap[tag][key]}`
  })
  return placeholder
}

// Ce 和占位符有关，比如 A 组件引用 B，但 B 还没有创建，或 B 已经创建，有不同的逻辑，配合 arrangePlaceholderReplace
export function shouldUsePlaceholder(e, comp: string): boolean {
  if (isDataThread()) {
    return comp !== tabbarComp && !(placeholderComponentMap[e] && placeholderComponentMap[e].has(comp))
  }
  return !componentLoaded(comp)
}

// Ne 逻辑较复杂
export function arrangePlaceholderReplace(
  compUsingPath: string,
  templateId: string,
  treeManager: TreeManager,
  replaceCallback: () => void
): void {
  placeholderUsingPathSet.add(compUsingPath)
  tmplPlaceholderFuncMap[templateId] = replaceCallback

  // 如有定时器删除
  tmplPlaceholderTimer !== undefined && clearTimeout(tmplPlaceholderTimer)

  // 重新设置替换任务
  tmplPlaceholderTimer = setTimeout(() => {
    const placeholderUsingPathArray: string[] = Array.from(placeholderUsingPathSet)
    const { rootCompName, viewId } = treeManager
    placeholderUsingPathSet = new Set() // 重置集合
    if (isDataThread()) {
      replacePlaceholderComponent(placeholderUsingPathArray, rootCompName, viewId)
      placeholderUsingPathArray.forEach((usingPath) => {
        placeholderKeysSet.delete(usingPath)
      })
      const compDef: ComponentDef = [[], [], rootCompName, ComponentAliases.componentAliases]
      placeholderUsingPathArray.forEach((usingPath) => {
        createComponentDef(compDef, usingPath, componentStateMap, rootCompName)
      })

      // 发送至视图层，开启作业流 (替换任务)
      sendData(EventName.SYNC_EVENT_NAME.COMPONENT_DEF_LAZY, compDef, viewId)
      treeManager.operationFlow.start()
      treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_DO_REPLACE_PLACEHOLDER])
      treeManager.operationFlow.end()

      const templateIds = Object.keys(tmplPlaceholderFuncMap)
      treeManager.operationFlow.start()
      treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_REPLACE_PLACEHOLDER, templateIds])
      templateIds.forEach((tmplId) => {
        tmplPlaceholderFuncMap[tmplId]()
        delete tmplPlaceholderFuncMap[tmplId]
      })
      treeManager.operationFlow.end()
    } else {
      replacePlaceholderComponent(placeholderUsingPathArray, rootCompName, null)
    }
  }, 50)
}

/**
 * 反解为 Pe
 * @engine service 逻辑层调用
 * @param options
 * @param tmplPath
 */
function handleProperties(options: exparser.ComponentRegisterOption, tmplPath?: string): exparser.ComponentRegisterOption {
  const properties: Record<string, Partial<exparser.BehaviorProperty>> = {}

  const isPropertyType = (o: any): o is exparser.PropertyType => {
    return o === Number || o === String || o === Boolean || o === Object || o === Array
  }

  for (const key in options.properties) {
    const property = options.properties[key]
    if (property === null) {
      properties[key] = {
        type: null
      }
    } else if (isPropertyType(property)) {
      properties[key] = {
        type: property.name
      }
    } else if (!(property.public !== undefined && !property.public)) {
      properties[key] = {
        type: !property.type ? null : (property.type as exparser.PropertyType).name,
        value: property.value
      }
    }
  }

  const innerDataExclude = options.options.innerDataExclude

  return {
    is: options.is,
    using: options.using,
    generics: options.generics,
    behaviors: options.behaviors,
    placeholder: options.placeholder,
    data: options.data,
    properties,
    externalClasses: options.externalClasses,
    template: tmplPath,
    options: {
      domain: options.options.domain,
      writeOnly: options.options.writeOnly || undefined,
      multipleSlots: options.options.multipleSlots || undefined,
      writeIdToDOM: options.options.writeIdToDOM || undefined,
      styleIsolation: options.options.styleIsolation || undefined,
      addGlobalClass: options.options.addGlobalClass || undefined,
      hasObservers: !!options.observers,
      innerDataExcludeString: innerDataExclude ? innerDataExclude.toString() : null,
      virtualHost: options.options.virtualHost || undefined
    }
  }
}

/**
 * 收集注册组件 (或 Behavior) 中引用的 Behavior，并将其引用信息存在特定的字典中
 * @param options
 */
function collectUsingBehaviorKeysToMap(options: exparser.ComponentRegisterOption): void {
  if (options.behaviors) {
    const behaviors: string[] = []

    for (const behaviorItem of options.behaviors) {
      const behaviorUsingKey: string = String(behaviorItem)
      if (behaviorUsingKey[0] !== '/' && behaviorUsingKey.slice(0, 5) !== 'dd://') {
        throw new Error('Behaviors should be constructed with Behavior()')
      }
      behaviors.push(behaviorUsingKey)
    }

    options.behaviors = behaviors
    behaviorUsingKeysMap[options.is] = behaviors
  } else {
    options.behaviors = null
  }
}

// 替换placeholder
let replacePlaceholderComponent = function(placeholderUsingPaths: string[], rootCompName: string, viewId: number | null) {
  const set = new Set()
  placeholderUsingPaths.forEach((e) => {
    setCompRouteLoadedSet(e, {
      set
    })
  })
  set.forEach((e) => {
    return ee(e, set)
  })
  const comps = loadSubpackage(rootCompName, set, viewId)
  comps.forEach((f) => compSet.add(f))

  if (comps.length !== 0) {
    if (isDataThread()) {
      // 逻辑层
      // const appServiceFiles = Array.from(comps).map((comp) => `/${comp}.appservice.js`)
      // loadJsFileToDataThread(appServiceFiles)
      Array.from(comps).forEach((comp) => {
        // __ddRoute = comp;
        // __ddRouteBegin = true;
        // __ddAppCurrentFile__ = `${comp}.js`
        // require(`${comp}.js`);
        const routeSet = new Set<string>()
        __appServiceSDK__.requireByRoute(comp, routeSet)
      })
    } else {
      // 视图层
      // const webviewFiles = Array.from(comps).map((comp) => `/${comp}.webview.js`)
      // loadJsFileToWebview(webviewFiles, callback)
    }
  }
}

// Fe
export function getOwnerPluginAppId(customComponent: CustomComponent): string {
  const exparserComponent = CustomComponent.getExparserComponent(customComponent)
  return exparserComponent ? CustomComponent.getExparserProtocol(exparserComponent) : ''
}

/**
 * 反解为 ze
 * @param def {ComponentDef} 组件的 Behavior、Component 引用与其定义信息，具体含义详见其 type
 * @param path {string} 组件的路径，实质上是其 Component 的 is
 * @param statusMap 按 is 字段为 key，value 标示某个 Component、Behavior 是否被构建处理
 * @param using
 */
function createComponentDef(def: ComponentDef, path: string, statusMap: Record<string, boolean>, using: string) {
  let key // 工具人

  // 如果有别名，进行一次转换
  if (hasOwnProperty.call(ComponentAliases.componentAliases, path)) {
    path = ComponentAliases.componentAliases[path]
  }

  const compRegisterOptions = customCompRegisterMap[path]
  if (!compRegisterOptions) {
    if (placeholderKeysSet.has(path)) {
      return undefined
    }
    throw new Error(`Component is not found in path "${ path }"${ using ? ` (using by "${ using }")` : ''}`)
  }

  // 如果非内置，则向 def 中 Components 队列添加(下标为1)，并设置其 status 为 true
  if (path.slice(0, 5) !== 'dd://') {
    def[1].unshift(compRegisterOptions)
    statusMap[path] = true
  }

  // 处理组件中引用的其他组件
  const compUsing = customCompUsingMap[compRegisterOptions.is]
  let usingPath: string
  for (key in compUsing) {
    if (hasOwnProperty.call(compUsing, key)) {
      usingPath = compUsing[key]
      statusMap[usingPath] || createComponentDef(def, usingPath, statusMap, path)
    }
  }

  // 处理抽象节点
  const compGenerics = customCompGenericsMap[compRegisterOptions.is]
  let genericPath: string
  for (key in compGenerics) {
    if (hasOwnProperty.call(compGenerics, key)) {
      genericPath = compGenerics[key].default
      if (genericPath) {
        statusMap[genericPath] || createComponentDef(def, genericPath, statusMap, path)
      }
    }
  }

  // 处理组件所引用的 Behavior，以及 Behavior 引用的 Behavior
  const usingBehaviorKeys = behaviorUsingKeysMap[compRegisterOptions.is]
  if (usingBehaviorKeys) {
    const loadBehavior = function(_def, _behaviorKey, _statusMap) {
      if (_behaviorKey.slice(0, 5) !== 'dd://') {
        const _behaviorRegisterOption = behaviorRegisterMap[_behaviorKey]
        if (!_behaviorRegisterOption) {
          throw new Error(`"${ _behaviorKey }" is not a behavior registered by Behavior()`)
        }
        // 如已在注册表内，将注册信息复制一份到 componentDef 中的 Behaviors 里 (下标为0)
        _def[0].unshift(_behaviorRegisterOption)
        _statusMap[_behaviorKey] = true
        const _usingBehaviorKeys = behaviorUsingKeysMap[_behaviorRegisterOption.is]
        if (_usingBehaviorKeys) {
          for (const usingbehaviorKey of _usingBehaviorKeys) {
            _statusMap[usingbehaviorKey] || loadBehavior(_def, usingbehaviorKey, _statusMap)
          }
        }
      }
    }
    for (const behaviorKey of usingBehaviorKeys) {
      statusMap[behaviorKey] || loadBehavior(def, behaviorKey, statusMap)
    }
  }
  return def
}

/**
 * Ve
 * Behavior 构造函数
 * @param options 注册 Behavior 的选项
 * @returns {string} behavior.is 标示
 */
export function Behavior(options: exparser.ComponentRegisterOption): string {
  const is = `/${ behaviorInstanceInc++ }/${ BasicMethod.guid()}`
  const behaviorOptions: exparser.ComponentRegisterOption = {}

  const behaviors = options.behaviors
  if (behaviors && behaviors.length) {
    for (let i = 0; i < behaviors.length; i++) {
      const behaviorKey = String(behaviors[i])
      if (behaviorKey.indexOf('wx://') !== -1) {
        behaviors[i] = `dd://${behaviorKey.substr(5)}`
      }
    }
  }
  behaviorOptions.behaviors = behaviors
  // 将传入的设置项复制一份，如果是 data 字段进行深拷贝
  for (const key in options) {
    behaviorOptions[key] = 'data' === key ? deepCopy(options[key]) : options[key]
  }

  behaviorOptions.is = is
  collectUsingBehaviorKeysToMap(behaviorOptions)

  behaviorOptions.options = defaultOptions
  behaviorRegisterMap[is] = handleProperties(behaviorOptions)

  behaviorOptions.definitionFilter = exparser.Behavior.callDefinitionFilter(behaviorOptions)
  exparser.registerBehavior(behaviorOptions)

  return behaviorOptions.is
}

// We -> CustomComponent.getExparserProtocol

// Ue -> CustomComponent.getExparserComponent

/**
 * He
 *
 * 将 json 文件的某些注册项，转移到注册组件的参数中
 * 由 styleIsolation、pureDataPattern 的逻辑结合微信文档推测该函数是处理 json 文件的
 *
 * @param registerOption 注册项
 * @param appCode 开发者的代码 (除了 JS 文件)
 * @param path 文件取掉后缀名的名称
 */
function handleJSONFile(registerOption: exparser.ComponentRegisterOption, appCode, path: string): void {
  const jsonOptions = appCode[`${path }.json`] || {}
  /**
   * @wx_docs
   * 从小程序基础库版本 2.10.1 开始，也可以在页面或自定义组件的 json 文件中配置 styleIsolation
   * （这样就不需在 js 文件的 options 中再配置)
   */
  if (jsonOptions.styleIsolation !== undefined) {
    if (!registerOption.options) {
      registerOption.options = {}
    }
    registerOption.options.styleIsolation = jsonOptions.styleIsolation
  }
  /**
   * @wx_docs
   * 从小程序基础库版本 2.10.1 开始，也可以在页面或自定义组件的 json 文件中配置 pureDataPattern
   * （这样就不需在 js 文件的 options 中再配置）。此时，其值应当写成字符串形式：
   *
   * 所以这里需要将其从 string -> RegExp
   */
  if (jsonOptions.pureDataPattern !== undefined) {
    if (!registerOption.options) {
      registerOption.options = {}
    }
    registerOption.options.pureDataPattern = new RegExp(jsonOptions.pureDataPattern)
  }
}

/**
 * 获取componentPlaceholder
 */
function getComponentPlaceholder(is, appCode) {
  const c = appCode[`${is }.json`] || {}
  const res = {}
  const cps = c.componentPlaceholder || {}
  Object.keys(cps).forEach(((e) => {
    res[`dd-${ e}`] = `dd-${ String(cps[e])}`
  }))
  return res
}

/**
 * 返回值是 Qe 的派生实例，CustomComponent
 * @engine service 逻辑层调用
 */
function createCustomComponent(options: exparser.ComponentRegisterOption, appCode): CustomComponent {
  options.using = customCompUsingMap[options.is] = getUsing(options.is, appCode)
  options.placeholder = getComponentPlaceholder(options.is, appCode)
  options.generics = customCompGenericsMap[options.is] = (function(is, appCodeList) {
    const i = {},
      n = (appCodeList[`${is }.json`] || {}).componentGenerics
    for (const o in n) {
      const r = n[o]
      'object' === _typeJudgement(r) ? i[`dd-${ o}`] = {
        default: BasicMethod.pathRelative(is, String(r.default || ''))
      } : null != r && (i[`dd-${ o}`] = {})
    }
    return i
  }(options.is, appCode))
  collectUsingBehaviorKeysToMap(options)

  let tmplPath = options.is
  if (appCode[`${tmplPath }.wxml`]) {
    tmplPath += '.wxml'
  } else if (appCode[`${tmplPath }.ddml`]) {
    tmplPath += '.ddml'
  }
  options.template = {
    path: tmplPath,
    func: updatedDdAppCode[tmplPath] || appCode[tmplPath] || null
  }
  customCompRegisterMap[options.is] = handleProperties(options, tmplPath)

  // innerComponent 是注册的组件，也是 exparser.Component._list 字典的 value 类型
  const componentTemplate: exparser.ComponentTemplate = exparser.registerElement(options)
  const customComponent = new CustomComponent()

  // 预构建 Behavior (这里需要手动构建是因为 VD 模块指定了 lazyRegistration 为 true，所以 exparser 不会在创建的自动构建)
  // prepare 完成后，behavior 对象上就已经存有完整的组件资源 (methods、data、props、observers....)
  exparser.Behavior.prepare(componentTemplate.behavior)

  // 转移 methods
  const methods = componentTemplate.behavior.methods
  for (const methodName in methods) {
    customComponent[methodName] = methods[methodName]
  }

  // 监听 route 中 js 文件的更新(or 加载?) 然后对应更新视图
  // addUpdateListener(`${options.is  }.js`, function (fn) {
  //   fn()

  //   const is = options.is
  //   const registerOption = customCompRegisterMap[is]

  //   const viewList = TreeManager.list()
  //   for (const view of viewList) {
  //     // jscore -> webview(指定 id)
  //     sendData(EventName.SYNC_EVENT_NAME.UPDATE_COMPONENT_DEF, [registerOption], view.viewId);
  //     if (view.root) {
  //       // eslint-disable-next-line
  //       BasicMethod.dfsComponents(view.root, 1, function (component) {
  //         if (component instanceof exparser.Component && component.is === is) {
  //           const rootEquals: boolean = component === view.root

  //           if (rootEquals && view.lifetimeListener) {
  //             view.lifetimeListener.call(view.root, 'onUnload')
  //           }
  //           resetComponentNode(component, view)

  //           if (rootEquals && view.lifetimeListener) {
  //             view.lifetimeListener.call(view.root, 'onLoad')
  //             view.lifetimeListener.call(view.root, 'onShow')
  //           }
  //         }
  //       })
  //     }
  //   }
  // })
  return customComponent
}

/**
 * 反解 $e
 * 对组件的样式隔离、template (VD 版本) 进行准备
 * @engine webview 视图层调用
 * @param compRegisterOption 组件的注册信息
 * @param isRootComp 是否为根节点组件
 * @param supportTabbar 是否为 tabbar，暂时不管这个参数以及与其相关的逻辑
 */
function prepareComponent(compRegisterOption: exparser.ComponentRegisterOption, isRootComp: boolean, supportTabbar?: boolean) {
  let key

  // 将 type 的类型从 string 转换为对应的构造函数
  for (key in compRegisterOption.properties) {
    const type = <string>(compRegisterOption.properties[key] as Partial<exparser.BehaviorProperty>).type;
    (compRegisterOption.properties[key] as Partial<exparser.BehaviorProperty>).type = propertiesTypeConstructor[type]
  }

  let classPrefix = ''
  if (!isRootComp) {
    // rt or ot
    classPrefix = supportTabbar ? tabbarClassPrefix[compRegisterOption.is] : classPrefixMap[compRegisterOption.is]
  }

  // 对 innerOptions 做一系列赋值
  const { options } = compRegisterOption
  const writeIdToDOM = !(!options.writeIdToDOM && !isRootComp)
  compRegisterOption.options = componentRegisterViewOptions
  compRegisterOption.options.multipleSlots = options.multipleSlots || false
  compRegisterOption.options.writeOnly = options.writeOnly || false
  compRegisterOption.options.writeIdToDOM = writeIdToDOM
  compRegisterOption.options.domain = options.domain
  compRegisterOption.options.randomizeTagName = false
  compRegisterOption.options.virtualHost = options.virtualHost

  // string -> reg
  compRegisterOption.options.innerDataExclude = (function(regExpString: string) {
    if (!regExpString) {
      return null
    }
    const lastSpaceIndex = regExpString.lastIndexOf('/') // 末尾的 '/' 索引
    const pattern = regExpString.slice(1, lastSpaceIndex) // 截取前后 '/' 之间的内容
    const flags = regExpString.slice(lastSpaceIndex + 1) // 获取末尾 '/' 右侧的符号
    return new RegExp(pattern, flags)
  }(options.innerDataExcludeString))


  // 组件样式隔离
  let disableAppDdss = false
  if (options.styleIsolation) {
    let styleIsolation: string = options.styleIsolation
    if (styleIsolation.slice(0, 5) === 'page-') {
      disableAppDdss = true
      styleIsolation = styleIsolation.slice(5)
    }
    if (styleIsolation === 'isolated') {
      classPrefix = classPrefixMap[compRegisterOption.is]
      compRegisterOption.options.addGlobalClass = false
    } else if (styleIsolation === 'strong-isolated') {
      classPrefix = classPrefixMap[compRegisterOption.is]
      compRegisterOption.options.addGlobalClass = false
      compRegisterOption.options.randomizeTagName = true
    } else if (styleIsolation === 'apply-shared') {
      classPrefix = classPrefixMap[compRegisterOption.is]
      compRegisterOption.options.addGlobalClass = true
    } else if (styleIsolation === 'shared' && options.domain === '/') {
      classPrefix = ''
      compRegisterOption.options.addGlobalClass = false
    } else {
      disableAppDdss = false
    }
  } else {
    compRegisterOption.options.addGlobalClass = options.addGlobalClass || false
  }

  // classPrefix (实现样式隔离的手段，重要)
  compRegisterOption.options.classPrefix = classPrefix
  if (options.hasObservers) {
    compRegisterOption.observers = {
      '**'() {
      }
    }
  }

  const customComponentMode = 'undefined' !== typeof __ddAppCode__ && __ddAppCode__[compRegisterOption.template as any]
  window.__customComponentMode__ = customComponentMode

  // 这里的 window.__generateFunc__ 会在 loadJsFileToWebview 回调中取到 __ddAppCode__['xxx.ddml'] 的值然后赋值
  const generateFunc = customComponentMode ? __ddAppCode__[compRegisterOption.template as any] : window.__generateFunc__

  // func 的调用能直接获得 AST 树 (webComponent 版)
  const templatePath = <string>compRegisterOption.template
  compRegisterOption.template = {
    path: templatePath,
    func: generateFunc
  }
  exparser.registerElement(compRegisterOption)
  return {
    disableAppDdss,
    classPrefix
  }
}

// e-> ComponentRegisterOption    n->appCode    o->jsFile
export function Component(options: exparser.ComponentRegisterOption, host?: string, code?: any, currentFile?: string): string {
  const jsFile = currentFile || __ddAppCurrentFile__
  const appCode = code || __ddAppCode__
  const config = appCode[`${jsFile }on`]
  if (!jsFile || !config) {
    console.warn(`Component ${ jsFile } constructors should be called while initialization. A constructor call has been ignored.`)
    return ''
  }
  const behaviors = options.behaviors
  if (behaviors && behaviors.length) {
    for (let i = 0; i < behaviors.length; i++) {
      const behaviorKey = String(behaviors[i])
      if (behaviorKey.indexOf('wx://') !== -1) {
        behaviors[i] = `dd://${behaviorKey.substr(5)}`
      }
    }
  }
  options.behaviors = behaviors

  const path = jsFile.slice(0, -3)
  if (config.component && 'simple' === config.component.type) {
    setComponentRegisterOption(options, path, host, appCode)
    return path
  }
  handleJSONFile(options, appCode, path)
  // 将 Behavior 自定义扩展的函数拼装在一起
  const definitionFilter = exparser.Behavior.callDefinitionFilter(options)
  const innerOptions = options.options || {}
  const registerOption: exparser.ComponentRegisterOption = {
    is: path,
    properties: options.properties,
    data: deepCopy(options.data),
    methods: options.methods,
    behaviors: options.behaviors,
    lifetimes: options.lifetimes,
    pageLifetimes: options.pageLifetimes,
    created: options.created,
    attached: options.attached,
    ready: options.ready,
    moved: options.moved,
    detached: options.detached,
    saved: options.saved,
    restored: options.restored,
    relations: options.relations ? handleRelations(jsFile, options.relations) : undefined,
    externalClasses: options.externalClasses,
    observers: options.observers,
    definitionFilter,
    // inner options 实际上是 VD 自己注入的，外界无法传入
    options: {
      ...componentRegisterLogicOptions,
      addGlobalClass: innerOptions.addGlobalClass || false,
      multipleSlots: innerOptions.multipleSlots || false,
      writeOnly: innerOptions.writeOnly || false,
      writeIdToDOM: false,
      domain: (innerOptions.writeOnly ? 'wo://' : '') + (host || '/'),
      styleIsolation: innerOptions.styleIsolation || '', // style隔离
      innerDataExclude: innerOptions.pureDataPattern || null,
      virtualHost: innerOptions.virtualHost || false
    },
    initiator() {
      this.__customConstructor__ = Component
      const caller = Object.create(customComponent) // h 是下方 createCustomComponent 的返回值提升
      CustomComponent.callerMap.set(caller, this) // 记录了指定上下文和实例之间的关联

      // 对实例指定了上下文，由其触发的回调 (observers、methods、data & props listener、lifetimes 均会以 caller 为回调中的 this)
      exparser.Element.setMethodCaller(this, caller)
      // 绑定了2个不可枚举的属性
      Object.defineProperties(caller, {
        __data__: {
          value: this.data,
          writable: true,
          enumerable: false
        },
        __ddWebViewId__: {
          value: this.__treeManager__.viewId,
          writable: true,
          enumerable: false
        }
      })
    }
  }
  const customComponent = createCustomComponent(registerOption, appCode)
  return registerOption.is
}

export function Page(data, domain?: string, node?, currentFile?: string): string {
  const jsFile: string = currentFile || __ddAppCurrentFile__
  if (!jsFile) {
    console.warn('Page constructors should be called while initialization. A constructor call has been ignored.')
    return ''
  }
  const path = jsFile.slice(0, -3)
  const appCode = node || ('undefined' !== typeof __ddAppCode__ && __ddAppCode__) || {}
  const freeData = Object.create(null)
  const options: exparser.ComponentRegisterOption = {
    methods: {}
  }

  let key
  for (key in data) {
    if (key === 'data') {
      options.data = data.data
    } else if (isFunction(data[key])) {
      options.methods[key] = data[key]
    } else if (key === 'methods') {
      freeData.methods = data.methods
    } else {
      options[key] = data[key]
    }
  }
  const behaviors = options.behaviors
  if (behaviors && behaviors.length) {
    for (let i = 0; i < behaviors.length; i++) {
      const behaviorKey = String(behaviors[i])
      if (behaviorKey.indexOf('wx://') !== -1) {
        behaviors[i] = `dd://${behaviorKey.substr(5)}`
      }
    }
  }
  options.behaviors = behaviors
  const checkBehaviors: boolean = (function(behaviorKeys) {
    if (!behaviorKeys) {
      return false
    }
    if (isArray(behaviorKeys)) {
      for (let i = 0; i < behaviorKeys.length; i++) {
        const behaviorKey = String(behaviorKeys[i])
        if ('dd://' !== behaviorKey.slice(0, 5) && !behaviorRegisterMap[behaviorKey]) {
          console.warn('"behaviors" list contains non-behavior items. The whole list is ignored.')
          return false
        }
      }
      return true
    }
    return false
  }(options.behaviors))
  handleJSONFile(options, appCode, path)
  if (checkBehaviors) {
    exparser.Behavior.callDefinitionFilter(options)
  }
  for (key in options) {
    if ('data' !== key && 'methods' !== key) {
      freeData[key] = options[key]
    }
  }
  let customComponent
  const innerOptions = options.options || {}
  const registerOption: exparser.ComponentRegisterOption = {
    is: path,
    behaviors: checkBehaviors ? options.behaviors : undefined,
    data: deepCopy(options.data),
    methods: options.methods,
    properties: data.properties === undefined ? options.properties : undefined,
    lifetimes: data.lifetimes === undefined ? options.lifetimes : undefined,
    pageLifetimes: data.pageLifetimes === undefined ? options.pageLifetimes : undefined,
    created: data.created === undefined ? options.created : undefined,
    attached: data.attached === undefined ? options.attached : undefined,
    ready: data.ready === undefined ? options.ready : undefined,
    moved: data.moved === undefined ? options.moved : undefined,
    detached: data.detached === undefined ? options.detached : undefined,
    saved: data.saved === undefined ? options.saved : undefined,
    restored: data.restored === undefined ? options.restored : undefined,
    relations: data.relations === undefined && options.relations ? handleRelations(jsFile, options.relations) : undefined,
    externalClasses: data.externalClasses === undefined ? options.externalClasses : undefined,
    observers: data.observers === undefined ? options.observers : undefined,
    options: {
      ...componentRegisterLogicOptions,
      multipleSlots: false,
      writeOnly: false,
      writeIdToDOM: true,
      domain: domain || '/',
      styleIsolation: innerOptions.styleIsolation || 'shared',
      addGlobalClass: false,
      innerDataExclude: innerOptions.pureDataPattern || null,
      virtualHost: innerOptions.virtualHost || false
    },
    initiator() {
      this.__customConstructor__ = Page
      const caller = Object.create(customComponent)
      CustomComponent.callerMap.set(caller, this)
      exparser.Element.setMethodCaller(this, caller)
      Object.defineProperties(caller, {
        __data__: {
          value: this.data,
          writable: true,
          enumerable: false
        },
        __ddWebViewId__: {
          value: this.__treeManager__.viewId,
          writable: true,
          enumerable: false
        }
      })
    }
  }
  customComponent = createCustomComponent(registerOption, appCode)
  customComponent.__freeData__ = freeData
  return registerOption.is
}

// Ke
function flowUpdateView(treeManager: TreeManager) {
  const flowUpdateStartTime = Date.now() // 用于上报性能指数
  const iterator = treeManager.operationFlow.iterator // 迭代器
  const depthStartTime = iterator.expectStart() // 迭代当前头部的 depth 事件，返回其 data 值 (时间戳)

  let nextStepType = iterator.nextStepType() // 下一次事件的类型，注意后续的逻辑会更改其值

  if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_INITIAL_CREATION) {
    // 初始创建视图层
    initialDisplay(treeManager, EventName.SYNC_EVENT_NAME.FLOW_INITIAL_CREATION)
  } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_INITIAL_RENDERING_CACHE) {
    // 推测是根据缓存，创建初始时的视图
    initialDisplay(treeManager, EventName.SYNC_EVENT_NAME.FLOW_INITIAL_RENDERING_CACHE)
  } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_CREATE_TAB) {
    // tabbar，暂时可以忽略
    initialDisplay(treeManager, EventName.SYNC_EVENT_NAME.FLOW_CREATE_TAB)
  } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_DO_REPLACE_PLACEHOLDER) {
    // 替换占位符，这部分目前推测可能和分包、同层渲染有关
    iterator.nextStep()
    TreeManager.instance.operationFlow.block()
    TreeManager.instance.operationFlow.unblock()
    pageLoadInfoCallbackMap.onCompDefLoaded(() => {
      pageLoadInfoCallbackMap.clearStatus()
      TreeManager.instance.operationFlow.unblock()
    })
  } else {
    /**
     * 其他非初创、替换等事件，伴随一次 nextStep
     */
    const nextStep = iterator.nextStep()
    let comp: exparser.Component
    nextStepType = nextStep[0]
    if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_UPDATE) {
      const nodeId: string = nextStep[1]
      comp = treeManager.nodeId.getNodeById(nodeId)
      if (comp) {
        const changes: [] = nextStep[2] // 带有数据更新的路径、值
        if (isArray(changes) && changes.length) {
          const dataProxy = exparser.Component.getDataProxy(comp)
          dataProxy.setChanges(changes)
          dataProxy.doUpdates(undefined, !isDataThread())
          updatePerformanceStatWithNodeIdToService(nodeId, (options) => {
            return {
              isMergedUpdate: false,
              dataPaths: options.withDataPaths ? changes.map((path) => path[0]) : undefined,
              pendingStartTimestamp: depthStartTime,
              updateStartTimestamp: flowUpdateStartTime,
              updateEndTimestamp: Date.now()
            }
          })
        }
      } else {
        iterator.skipToEnd()
      }
    } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_GROUP) {
      const u = iterator.nextStep()
      if (u[0] !== EventName.SYNC_EVENT_NAME.FLOW_GROUP_END) {
        throw new Error(`Framework inner error (expect FLOW_GROUP_END but get ${ EventName.getEvName(u[0]) })`)
      }
    } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_REPLACE_PLACEHOLDER) {
      nextStep[1].forEach((ballNumber) => {
        tmplPlaceholderFuncMap[ballNumber]()
        delete tmplPlaceholderFuncMap[ballNumber]
      })
    } else if (nextStepType === EventName.SYNC_EVENT_NAME.FLOW_HOT_UPDATE) {
      comp = treeManager.nodeId.getNodeById(nextStep[1])
      if (comp) {
        comp.__templateInstance._resetShadowChildren(comp, comp.data, treeManager)
      } else {
        iterator.skipToEnd() // 快进至 depth end
      }
    } else {
      if (nextStepType !== EventName.SYNC_EVENT_NAME.FLOW_HOT_UPDATE_RESET) {
        throw new Error(`Framework inner error (expect an update event but get ${ EventName.getEvName(nextStepType) })`)
      }
      const node = treeManager.nodeId.getNodeById(nextStep[1])
      resetComponentNode(node, treeManager)
    }
  }
  iterator.expectEnd()
}

// view -> e, eventName -> t
function initialDisplay(treeManager: TreeManager, eventName: number): void {
  const isFlowCreateTab = eventName === EventName.SYNC_EVENT_NAME.FLOW_CREATE_TAB // n
  const isFlowInitialRenderingCache = eventName === EventName.SYNC_EVENT_NAME.FLOW_INITIAL_RENDERING_CACHE // o
  const iterator = treeManager.operationFlow.iterator // r
  let idData // i
  let nextStep = iterator.nextStep() // a
  let node = null // c

  const componentIs = nextStep[1] // componentIs -> s
  const nodeId = nextStep[2] // nodeId -> l

  // 根据 eventName 先做一些处理 (STEP 1)
  if (isFlowCreateTab) {
    treeManager.tabNodeId = nodeId
    treeManager.tabRoot = node = window.__TAB_BAR__ = <exparser.Component>exparser.createElement(
      'tab-bar',
      exparser.Component._list[componentIs]
    )
  } else if (isFlowInitialRenderingCache) {
    if (!componentIs) {
      saveDynamicInitialRenderingCache(null)
      return undefined
    }
    node = exparser.createElement('initial-rendering-cache', exparser.Component._list[componentIs])
  } else {
    const shadowRoot = nextStep[3] || {}
    treeManager.rootNodeId = nodeId
    treeManager.root = node = window.__DOMTree__ = <exparser.Component>exparser.Component.createWithGenerics(
      'body',
      exparser.Component._list[componentIs],
      shadowRoot,
      treeManager
    )
  }

  treeManager.nodeId.allocNodeId(node, nodeId)
  node.setAttribute('is', componentIs)

  if (PageState.restoring && !isFlowCreateTab) {
    idData = PageState.idDataMap[treeManager.nodeId.getNodeId(node)]
    exparser.Component.replaceWholeData(node, idData, null)
    callRestoredLifeTimes(PageState.restoring)
    PageState.restoring = null
    PageState.idDataMap = null
  }

  // iterator -> next
  nextStep = iterator.nextStep()
  if (nextStep[0] !== eventName) {
    throw new Error(
      `Framework inner error (expect ${
        EventName.getEvName(eventName)
      } end but get ${
        EventName.getEvName(nextStep[0])
      })`
    )
  }

  treeManager.nodeId.addNode()

  // 根据 eventName 再做一次处理，有 DOM 操作 (STEP 2)
  if (isFlowCreateTab) {
    const $ddTabBarWrapper = exparser.createElement(
      'dd-tab-bar-wrapper',
      exparser.Component._list['dd://tab-bar-wrapper']
    )
    $ddTabBarWrapper.appendChild(node)
    document.documentElement.insertBefore($ddTabBarWrapper.$$, document.body)

    // 将元素之间通过 childNoes 属性进行挂载
    exparser.Element.pretendAttached($ddTabBarWrapper)

    if (treeManager.tabDestroyed) {
      $ddTabBarWrapper.removeChild(node)
    }
  } else if (isFlowInitialRenderingCache) {
    // create & mounted dom
    const $cacheWrapper = document.createElement('dd-initial-rendering-cache-wrapper')
    $cacheWrapper.setAttribute('style', 'height: 0; overflow: hidden')
    $cacheWrapper.appendChild(node.$$)
    document.documentElement.insertBefore($cacheWrapper, document.body)

    // iterator -> next
    nextStep = iterator.nextStep()
    if (nextStep[0] !== EventName.SYNC_EVENT_NAME.FLOW_INITIAL_RENDERING_CACHE) {
      throw new Error('Framework inner error (expect initial rendering end but get another)')
    }

    dfsComponents(node, 1, (component) => {
      component.triggerLifeTime('cacheAttached')
    })
    saveDynamicInitialRenderingCache(node, nextStep[1])

    // remove dom
    treeManager.nodeId.removeNode(node)
    document.documentElement.removeChild($cacheWrapper)
  } else {
    /**
     * 视图挂载
    */
    document.body = node.$$
    dfsComponents(node, 1, (component) => {
      component.triggerLifeTime('cacheAttached')
    })
    saveStaticInitialRenderingCache(node)
    exparser.Element.pretendAttached(node)

    // Performance
    addPerformanceData('initialRenderingDone', Date.now())
    setTimeout(() => sendPerformanceData(), 0)
  }

  // fn end
}

// tt
export function initViewThread() {
  OperationFlow.setStartOperation((treeManager: TreeManager) => {
    pushOperationFlowStack()
    try {
      flowUpdateView(treeManager)
    } catch (err) {
      popOperationFlowStack()
      let error = '[webview-error]: flowUpdateView error\n'
      err.name && (error += `[${err.name}] `)
      err.message && (error += (`${err.message }\n`))
      err.stack && (error += err.stack)
      if (error.length > 1000) {
        error = `${error.substr(0, 1000) } ...`
      }
      Reporter.errorReport({
        key: 'webview-error',
        type: 'flowUpdateView',
        error
      })
      Reporter.ravenReport('pub_saga_error_message_bt', {
        key: 'webview-error',
        type: 'flowUpdateView',
        error,
        fail(ravenReportFail) {
          console.error('report webview-error fail: ', ravenReportFail)
        }
      })
      throw err
    }
    popOperationFlowStack()
  })
  TreeManager.instance = TreeManager.create(0)
}

/**
 * 反解为 at
 * 对 ComponentDef 进行处理
 * @engine webview 视图层调用，也是视图层的注册组件之处
 * @param def
 * @param isTabbar {boolean}
 */
function handleComponentDef(def: ComponentDef, isTabbar: boolean) {
  if (!isTabbar) {
    // registerSavingListener()
  }
  const [behaviors, components, rootCompName, componentAliases] = def
  if (!isTabbar) {
    TreeManager.instance.rootCompName = rootCompName
  }
  const rootStyleCode = <Function>(__ddAppCode__[`${rootCompName }.wxss`] || __ddAppCode__[`${rootCompName }.ddss`])
  typeof rootStyleCode === 'function' && rootStyleCode(rootCompName)
  for (const behaviorRegisterItem of behaviors) {
    behaviorRegisterItem.options = defaultOptions
    exparser.registerBehavior(behaviorRegisterItem)
  }

  const isList: string[] = components.map((comp) => comp.is)
  if (isTabbar) {
    tabbarClassPrefix = componentClassPrefix || collectClassPrefix(isList)
  } else {
    // 此处尽量不做拷贝
    classPrefixMap = collectClassPrefix(components)
  }

  let comp: exparser.ComponentRegisterOption
  for (comp of components) {
    const isPageRoot = comp.is === rootCompName && !isTabbar
    const { disableAppDdss } = prepareComponent(comp, isPageRoot, isTabbar)
    if (disableAppDdss && isPageRoot) {
      __webviewEngine__.disableStyleElement('app.wxss')
      __webviewEngine__.disableStyleElement('app.ddss')
    }
    // const styleFilePath = comp.is + '.wxss'
    const styleCode = <Function>(__ddAppCode__[`${comp.is }.wxss`] || __ddAppCode__[`${comp.is }.ddss`])
    typeof styleCode === 'function' && styleCode(comp.is)
  }

  // 全局样式?
  // addUpdateListener('app.wxss', function (setCssToHead) {
  //   if (setCssToHead) {
  //     setCssToHead('', { allowIllegalSelector: true })
  //   } else {
  //     __styleSheetManager__.setCss('./app.wxss', '')
  //     document.dispatchEvent(new CustomEvent('pageReRender', {}))
  //   }
  // })

  // _list 中的 key 在 aliases 中转换一次
  for (const key in componentAliases) {
    exparser.Component._list[key] = exparser.Component._list[componentAliases[key]]
  }
}

function dt(viewId: number, treeManager: TreeManager, route: string) {
  route = convertRouteToComponentAlias(route)
  // 长度为4的数组，推测是 componentDef，描述了一个在逻辑层的完整页面组件资源
  const usedDef: ComponentDef = [[], [], route, ComponentAliases.componentAliases]
  componentStateMap = Object.create(null)
  createComponentDef(usedDef, route, componentStateMap, '')
  const generics = null
  // var o = function(orientation) {
  //   var sides = ComponentAliases.componentPathToAlias[orientation];
  //   if (!sides) {
  //     return {};
  //   }
  //   var match = sides.match(/^plugin:\/\/(dd[0-9a-f]{16})\/(.+)$/);
  //   if (!match) {
  //     return {};
  //   }
  //   var provider = match[1];
  //   var type = match[2];
  //   var gltypes = BasicMethod.objectValues(__ddConfig.plugins).find(function(syncAttributes) {
  //     return syncAttributes.provider === provider;
  //   });
  //   if (!gltypes) {
  //     return {};
  //   }
  //   if (!gltypes.genericsImplementation) {
  //     return {};
  //   }
  //   var template = gltypes.genericsImplementation[type] || {};
  //   var documents = {};
  //   var data = getPluginSubPackagePrefix(provider);
  //   // 添加前缀
  //   Object.keys(template).forEach(function(i) {
  //     documents["dd-" + i] = Object(BasicMethod.pathRelative)(data, String(template[i]));
  //   })
  //   return documents;
  // }(route);
  // BasicMethod.objectValues(o).forEach(function(e) {
  //   createComponentDef(usedDef, e, ut, "");
  // })

  sendData(EventName.SYNC_EVENT_NAME.COMPONENT_DEF, usedDef, viewId)
  BannerMap.sendBannedMap(viewId)
  treeManager.rootCompName = route
  treeManager.rootNodeId = BasicMethod.guid()
  treeManager.operationFlow.start()
  treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_INITIAL_CREATION, route, treeManager.rootNodeId, generics])

  const root = <exparser.Component>exparser.Component.createWithGenerics('body', exparser.Component._list[route], generics, treeManager)
  treeManager.root = root
  treeManager.usedDef = usedDef
  exparser.Element.getMethodCaller(root).__ddExparserNodeId__ = treeManager.nodeId.allocNodeId(root, treeManager.rootNodeId)
  exparser.Element.getMethodCaller(root).__wxExparserNodeId__ = exparser.Element.getMethodCaller(root).__ddExparserNodeId__
  treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_INITIAL_CREATION])
  treeManager.nodeId.addNode()
  return root
}

// ht
export function runComponentDef() {
  initRenderDone = true

  // Tabbar 逻辑暂时去掉
  sendTabBarCreationRequest()
  // COMPONENT_DEF
  comDefs.forEach((defs) => handleComponentDef(defs, false))
  comDefs = []

  // COMPONENT_DEF_TAB
  comTabDefs.forEach((defs) => handleComponentDef(defs, true))
  comTabDefs = []
}

// pt (初始化一些监听函数)
function initViewListener(viewId: Readonly<number>, treeManager: TreeManager) {
  if (!treeManager.listenerInited) {
    treeManager.listenerInited = true

    /**
     * DD Event
     */
    setDataListener(EventName.SYNC_EVENT_NAME.DD_EVENT, (data) => {
      const [nodeId, methodName, eventResult]: [string, string, VirtualDOMEvent] = data
      const comp: exparser.Component = treeManager.nodeId.getNodeById(nodeId)

      if (comp) {
        const methodCaller = exparser.Element.getMethodCaller(comp)
        const { _userTap, _requireActive, _relatedInfo } = eventResult

        // 如果该事件需要页面处于激活状态
        if (_requireActive) {
          const pages = __appServiceEngine__.getCurrentPagesByDomain('')
          if (pages[pages.length - 1].__ddWebViewId__ !== viewId) {
            return undefined
          }
          delete eventResult._requireActive
        }

        if (_relatedInfo) {
          // __appServiceEngine__.DisplayReporter.setEventRelatedInfo(eventResult._relatedInfo);
          delete eventResult._relatedInfo
        }

        // 调用绑定事件的函数
        const bindedEventMethod: unknown = methodCaller && methodCaller[methodName]
        if (!isFunction(bindedEventMethod)) {
          console.warn(`Component "${ comp.is }" does not have a method "${ methodName }" to handle event "${ eventResult.type }".`)
        } else if (_userTap) {
          wrapTapMark(() => {
            // __appServiceSDK__.setDdInterfaceIsInvokeInTap(eventResult.type);
            exparser.safeCallback('Event Handler', bindedEventMethod, methodCaller, [eventResult], comp)
            // __appServiceSDK__.unsetDdInterfaceIsInvokeInTap();
          })
        } else {
          exparser.safeCallback('Event Handler', bindedEventMethod, methodCaller, [eventResult], comp)
        }
      }
    }, viewId)

    /**
     * Model Value Change
     */
    setDataListener(EventName.SYNC_EVENT_NAME.MODEL_VALUE_CHANGE, (args, eventType, receivedViewId) => {
      const modelValueChange = args[0]
      const { data, modelValueName, nodeId } = modelValueChange
      setModelValueData(data, modelValueName, receivedViewId, nodeId)
    }, viewId)

    /**
     * Request Save
     */
    setDataListener(EventName.SYNC_EVENT_NAME.REQUEST_SAVE, (data) => {
      saveView(viewId, data)
    }, viewId)

    /**
     * Call Method From DDS (.wxs)
     */
    setDataListener(EventName.SYNC_EVENT_NAME.CALL_METHOD_FROM_DDS, (e) => {
      Dds.callMethodFromDdsCallback(e)
    }, viewId)

    /**
     * Animation Transition End
     */
    setDataListener(EventName.SYNC_EVENT_NAME.ANIMATION_TRANSITION_END, (events) => {
      let artistTrack
      let assignTag
      if (events && events[0] && events[0].reqId) {
        if ('function' === typeof (artistTrack = treeManager.applyAnimationCbMap[events[0].reqId])) {
          delete treeManager.applyAnimationCbMap[events[0].reqId]
          exparser.safeCallback('Animation', artistTrack, null, [])
        }
        assignTag = JSON.parse(events[0].args)
        treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_SET_NODE_NEXT_ANIMATION_INFO, assignTag])
      }
    }, viewId)
    setDataListener(EventName.SYNC_EVENT_NAME.CLEAR_ANIMATION_COMPLETE, (state) => {
      let artistTrack
      if (state && state[0] && state[0].reqId) {
        if ('function' === typeof (artistTrack = treeManager.clearAnimationCbMap[state[0].reqId])) {
          delete treeManager.clearAnimationCbMap[state[0].reqId]
          exparser.safeCallback('Clear Animation', artistTrack, null, [])
        }
      }
    }, viewId)

    /**
     * Response View Info
     */
    setDataListener(EventName.SYNC_EVENT_NAME.RESPONSE_VIEW_INFO, (data) => {
      const [response, callbackId] = data
      if (!!callbackId) {
        const callback = treeManager.viewInfoCbMap[callbackId]
        callback && callback(response) // 触发的是 requestViewInfo 中注册回调
      }
    }, viewId)

    /**
     * Update Performance Stat
     */
    setDataListener(EventName.SYNC_EVENT_NAME.UPDATE_PERFORMANCE_STAT, (data) => {
      const [nodeId, performanceStat] = data
      const exparserNode = treeManager.nodeId.getNodeById(nodeId)
      if (exparserNode && exparserNode.__updatePerformanceListener__) {
        exparser.safeCallback(
          'Update Performance Listener',
          exparserNode.__updatePerformanceListener__,
          exparser.Element.getMethodCaller(exparserNode),
          [performanceStat],
          exparserNode
        )
      }
    }, viewId)
  }
}

// ft -> CustomComponent.prototype.pushInitialRenderingCache

// gt -> CustomComponent.prototype.clearInitialRenderingCache

// _t
export function sendTabBarCreationRequest() {
  if (!tabCreateRequested) {
    tabCreateRequested = true
    sendData(EventName.SYNC_EVENT_NAME.REQUEST_TAB, [])
  }
}

// wraper
function handleWebviewJs(func) {
  !__ddConfig || !__ddConfig.isLazyLoad || loadedCustomTabbar ? func() : tempFuncs.push(func)
}

function wt() {
  if (loadedCustomTabbar !== true) {
    loadedCustomTabbar = true
    tempFuncs.forEach((saveNotifs) => {
      saveNotifs()
    })
  }
}

function checkTabbar(treeManager: TreeManager, route: string, viewId: number) {
  let n = true
  let tabBarList = __ddConfig.tabBar && __ddConfig.tabBar.list
  // tabBar的页面是否存在
  if (tabBarList instanceof Array) {
    tabBarList = tabBarList.map((o) => {
      return o && o.pagePath
    })
    if (tabBarList.indexOf(`${route }.html`)) {
      n = false
    }
  }
  // 不存在则销毁tabBar
  if (n) {
    treeManager.tabDestroyed = true
    sendData(EventName.SYNC_EVENT_NAME.DESTROY_TAB, [], viewId)
  }
}

// xt
function initViewTabbar(viewId: number, flag?: boolean) {
  if (isEnableTabbar()) {
    const treeManager = TreeManager.get(viewId) || TreeManager.create(viewId)
    // initViewListener(viewId, treeManager);
    if (!(treeManager.tabRoot || treeManager.tabDestroyed)) {
      lazyLoad(tabbarComp, viewId, isThisFirstPage, true)

      const tabCompName = convertRouteToComponentAlias(tabbarComp)
      const tabUsedDef: ComponentDef = [[], [], tabCompName, {}]
      createComponentDef(tabUsedDef, tabCompName, Object.create(null), '')
      // sendData(EventName.SYNC_EVENT_NAME.COMPONENT_DEF_TAB, tabUsedDef, viewId)
      treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.COMPONENT_DEF_TAB, tabUsedDef, viewId])

      treeManager.tabCompName = tabCompName
      treeManager.tabNodeId = guid()

      treeManager.operationFlow.start() // start
      treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_CREATE_TAB, tabCompName, treeManager.tabNodeId])

      const tabBarComponent = <exparser.Component>exparser.createElement('tab-bar', exparser.Component._list[tabCompName], treeManager)
      treeManager.tabRoot = tabBarComponent
      treeManager.tabUsedDef = tabUsedDef

      exparser.Element.getMethodCaller(tabBarComponent).__ddExparserNodeId__ = treeManager.nodeId.allocNodeId(tabBarComponent, treeManager.tabNodeId)
      exparser.Element.getMethodCaller(tabBarComponent).__wxExparserNodeId__ = exparser.Element.getMethodCaller(tabBarComponent).__ddExparserNodeId__
      treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLOW_CREATE_TAB])
      treeManager.nodeId.addNode()
      exparser.Element.pretendAttached(treeManager.tabRoot)

      treeManager.operationFlow.end() // end

      if (flag) {
        treeManager.operationFlow.push([EventName.SYNC_EVENT_NAME.FLUSH_BLOCKED, [], viewId])
        // sendData(EventName.SYNC_EVENT_NAME.FLUSH_BLOCKED, [], viewId)
      }
      if (treeManager.rootCompName) {
        checkTabbar(treeManager, treeManager.rootCompName, viewId)
      }
    }
  }
}

// Ct
function isEnableTabbar(): boolean {
  let enableTabbar = false
  // 配置项里是否包含tar
  if (__ddConfig.tabBar && true === __ddConfig.tabBar.custom) {
    enableTabbar = true
  }
  if (!Et(tabbarComp)) {
    enableTabbar = false
  }
  // 微信单页面模式不允许使用tabbar
  if (__ddConfig.appLaunchInfo && 'singlePage' === __ddConfig.appLaunchInfo.mode) {
    enableTabbar = false
  }
  return enableTabbar
}

function Et(alias: string): exparser.ComponentRegisterOption {
  alias = convertRouteToComponentAlias(alias)
  if (hasOwnProperty.call(ComponentAliases.componentAliases, alias)) {
    alias = ComponentAliases.componentAliases[alias]
  }
  return customCompRegisterMap[alias]
}

function checkNeedTabbar(route) {
  let tabBarList = __ddConfig.tabBar && __ddConfig.tabBar.list
  // tabBar的页面是否存在
  if (tabBarList instanceof Array) {
    tabBarList = tabBarList.map((o) => {
      return o && o.pagePath
    })

    if (tabBarList.indexOf(route) >= 0) {
      return true
    }
  }

  return false
}

// kt
/**
 *
 * @param {number} viewId
 * @param {string} route 'pages/index/index'
 * @param lifetimeListener
 */
export function addView(viewId: number, route: string, lifetimeListener?): exparser.Component {
  const treeManager = TreeManager.get(viewId) || TreeManager.create(viewId)
  treeManager.lifetimeListener = lifetimeListener
  treeManager.operationFlow.unblock()

  initViewListener(viewId, treeManager)
  route = convertRouteToComponentAlias(route)


  // var o = (__ddConfig.subPackages || []).filter(function(e) {
  //   return !!e['allExtendedComponents']
  // });

  sendData(EventName.SYNC_EVENT_NAME.LOAD_COMPONENT_DEF, [route], viewId)
  lazyLoad(route, viewId, isThisFirstPage)
  isThisFirstPage = false
  // if (!Et(route)) {
  //   route = "dd://not-found";
  // }
  const comp = dt(viewId, treeManager, route)

  if (checkNeedTabbar(route)) {
    initViewTabbar(viewId, true)
  }

  return comp
}

// Tt
export function attachView(webViewId: number, initialRootData: Record<string, any>): void {
  const treeManager = TreeManager.get(webViewId)
  if (treeManager) {
    const root = treeManager.root
    let shouldSetData: boolean = false
    const o = {}
    Object.keys(initialRootData).forEach((i) => {
      if (exparser.Component.hasProperty(root, i)) {
        o[i] = initialRootData[i]
        shouldSetData = true
      }
    })
    if (shouldSetData) {
      treeManager.root.setData(o)
    }
    if (isUpdateListenerEnabled()) {
      treeManager.initialRootData = initialRootData
    }
    exparser.Element.pretendAttached(root)
    treeManager.root.__treeManager__.operationFlow.end()
  }
}

// Mt
export function removeView(webViewId: number) {
  const treeManager = TreeManager.get(webViewId)
  if (treeManager) {
    exparser.Element.pretendDetached(treeManager.root)
    TreeManager.destroy(webViewId)
    removeDataListeners(webViewId)
  }
}

export function requestViewInfo(
  viewInfoKey: ViewInfoEnum | ViewInfoEnum[keyof ViewInfoEnum],
  requestViewInfoOptions:
  | __virtualDOM__.NodesRef.RequestViewInfoOptions
  | __virtualDOM__.Intersection.RequestViewInfoOptions,
  viewId: number,
  viewInfoCallback: __virtualDOM__.NodesRef.Callback
): string | void {
  const callbackId = `${Math.random() }-${ Date.now()}`
  const treeManager = TreeManager.get(viewId)
  if (treeManager) {
    treeManager.operationFlow.push([
      EventName.SYNC_EVENT_NAME.FLOW_VIEW_INFO,
      viewInfoKey,
      requestViewInfoOptions,
      callbackId
    ])
    if (isFunction(viewInfoCallback)) {
      treeManager.viewInfoCbMap[callbackId] = viewInfoCallback
    }
    return callbackId
  }
}

export function endViewInfoCallback(viewId: number, viewInfoCallbackId: string): void {
  const treeManager = TreeManager.get(viewId)
  treeManager && delete treeManager.viewInfoCbMap[viewInfoCallbackId]
}

export function componentLoaded(comp) {
  return compSet.has(comp)
}

/**
 * 设置组件的参数类型
 * @engine service 逻辑层调用
 */
function setComponentRegisterOption(registerOption: exparser.ComponentRegisterOption, path: string, domain: string, appCode): void {
  handleJSONFile(registerOption, appCode, path)
  const o = {
      is: path,
      using: getUsing(path, appCode),
      properties: registerOption.properties,
      externalClasses: registerOption.externalClasses,
      options: componentRegisterLogicOptions
    },
    r = registerOption.options || {}
  o.options = {
    ...componentRegisterLogicOptions,
    multipleSlots: r.multipleSlots || false,
    writeOnly: true,
    writeIdToDOM: false,
    domain: `simple://${ domain || '/'}`,
    styleIsolation: r.styleIsolation || '', // style隔离
    addGlobalClass: r.addGlobalClass || false,
    innerDataExclude: null,
    virtualHost: false
  }
  let tmplPath = path
  if (appCode[`${tmplPath }.wxml`]) {
    tmplPath += '.wxml'
  } else if (appCode[`${tmplPath }.ddml`]) {
    tmplPath += '.ddml'
  }
  customCompRegisterMap[path] = handleProperties(o, tmplPath)
}
