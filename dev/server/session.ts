import MindPalace from '../../src/index'

let instance: MindPalace | null = null

export const initialize = (config: ConstructorParameters<typeof MindPalace>[0]) => {
    instance = new MindPalace(config)
    return instance
}

export const getInstance = () => instance

export const reset = () => {
    instance = null
}
