from view.userinterface import UserInterface
from controller.game_controller import GameController

def main():
    ui = UserInterface()
    controller = GameController(ui)
    controller.initialize_game()
    controller.start_game_loop()

if __name__ == "__main__":
    main()